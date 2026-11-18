import io
import os
import stat
import tempfile
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests
from click.testing import CliRunner

import recce.github as github_module
from recce.github import download_artifact

FILE_ATTR = (stat.S_IFREG | 0o644) << 16
DIR_ATTR = ((stat.S_IFDIR | 0o755) << 16) | 0x10
REJECTED = (ValueError, OSError)
CORRUPTED = (ValueError, OSError, zipfile.BadZipFile)


@pytest.fixture(autouse=True)
def offline_artifact_tests(monkeypatch):
    from recce import event

    monkeypatch.setattr(event, "init", lambda: None)
    monkeypatch.setattr(event, "should_log_event", lambda: False)
    monkeypatch.setattr(event, "flush_events", lambda: None)
    monkeypatch.setattr(event, "log_codespaces_events", lambda command: None)

    def blocked(*args, **kwargs):
        raise AssertionError("Artifact tests must remain offline")

    monkeypatch.setattr(requests.sessions.Session, "send", blocked)


def make_zip(entries):
    """Build a ZIP from (name, data[, external_attr]) tuples, keeping names verbatim."""
    buf = io.BytesIO()
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # duplicate member names
        with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_STORED) as zf:
            for entry in entries:
                name, data = entry[0], entry[1]
                zi = zipfile.ZipInfo(name)
                zi.filename = name  # ZipInfo strips NUL; keep the original bytes on disk
                zi.create_system = 3
                if len(entry) > 2:
                    zi.external_attr = entry[2]
                else:
                    zi.external_attr = DIR_ATTR if name.endswith("/") else FILE_ATTR
                zf.writestr(zi, data)
    return buf.getvalue()


def snapshot(base):
    """Map every path under base to its type and content, without following symlinks."""
    result = {}
    for dirpath, dirnames, filenames in os.walk(base):
        for name in dirnames + filenames:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, base)
            st = os.lstat(path)
            if stat.S_ISLNK(st.st_mode):
                result[rel] = ("link", os.readlink(path))
            elif stat.S_ISDIR(st.st_mode):
                result[rel] = ("dir",)
            else:
                with open(path, "rb") as f:
                    result[rel] = ("file", f.read(), st.st_ino)
    return result


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    root = tmp_path / "root"
    outside = tmp_path / "outside"
    root.mkdir()
    outside.mkdir()
    (outside / "target.txt").write_text("outside")
    monkeypatch.chdir(root)
    return SimpleNamespace(tmp=tmp_path, root=root, outside=outside)


@pytest.fixture
def serve(monkeypatch):
    def _serve(content):
        response = MagicMock()
        response.content = content
        response.__enter__.return_value = response
        response.iter_content.side_effect = lambda chunk_size: iter([content])
        response.raise_for_status.return_value = None
        monkeypatch.setattr(github_module.requests, "get", MagicMock(return_value=response))
        return SimpleNamespace(archive_download_url="https://example.invalid/artifact.zip", content=content)

    return _serve


def extract_to_workspace(_token, artifact):
    """Keep the generic extractor regressions independent of the download content policy."""
    with zipfile.ZipFile(io.BytesIO(artifact.content)) as archive:
        github_module._extract_zip(archive, os.getcwd())
        return archive.namelist()


def assert_rejected(workspace, artifact, errors=REJECTED):
    before = snapshot(workspace.tmp)
    with pytest.raises(errors):
        extract_to_workspace("token", artifact)
    assert snapshot(workspace.tmp) == before


def test_extracts_nested_files_and_directories(workspace, serve):
    (workspace.root / "data").mkdir()
    (workspace.root / "data" / "unrelated.txt").write_text("keep")
    (workspace.root / "existing.txt").write_text("old")
    entries = [
        ("manifest.json", b"{}"),
        ("data/", b""),
        ("data/nested/deep/file.txt", b"deep"),
        ("empty/", b""),
        ("nested/empty/", b""),
        ("existing.txt", b"new"),
        ("no_type_bits.txt", b"plain", 0),
        ("perm_only.txt", b"perm", 0o644 << 16),
        ("dos_dir/", b"", 0x10),
        ("untyped_dir/", b"", 0),
    ]
    artifact = serve(make_zip(entries))

    names = extract_to_workspace("token", artifact)

    assert names == [e[0] for e in entries]
    tree = {k: v[:2] for k, v in snapshot(workspace.root).items()}
    assert tree == {
        "manifest.json": ("file", b"{}"),
        "data": ("dir",),
        "data/unrelated.txt": ("file", b"keep"),
        "data/nested": ("dir",),
        "data/nested/deep": ("dir",),
        "data/nested/deep/file.txt": ("file", b"deep"),
        "empty": ("dir",),
        "nested": ("dir",),
        "nested/empty": ("dir",),
        "existing.txt": ("file", b"new"),
        "no_type_bits.txt": ("file", b"plain"),
        "perm_only.txt": ("file", b"perm"),
        "dos_dir": ("dir",),
        "untyped_dir": ("dir",),
    }


def test_overwrite_hardlinked_leaf_does_not_write_through(workspace, serve):
    target = workspace.outside / "target.txt"
    inode = os.stat(target).st_ino
    os.link(target, workspace.root / "report.json")
    artifact = serve(make_zip([("report.json", b"new")]))

    extract_to_workspace("token", artifact)

    assert target.read_text() == "outside"
    assert os.stat(target).st_ino == inode
    assert (workspace.root / "report.json").read_bytes() == b"new"
    assert os.stat(workspace.root / "report.json").st_ino != inode


@pytest.mark.parametrize(
    "name",
    [
        "../outside/evil.txt",
        "..",
        "a/../../outside/evil.txt",
        "a/../evil.txt",
        "ABSOLUTE",
        "..\\outside\\evil.txt",
        "dir\\evil.txt",
        "C:/evil.txt",
        "C:evil.txt",
        "//server/share/evil.txt",
        "\\\\server\\share\\evil.txt",
        "evil.txt\x00.json",
    ],
)
def test_rejects_unsafe_member_names(workspace, serve, name):
    if name == "ABSOLUTE":
        name = str(workspace.outside / "evil.txt")
    (workspace.root / "keep.txt").write_text("old")
    artifact = serve(make_zip([("keep.txt", b"new"), ("ok/file.txt", b"ok"), (name, b"evil")]))

    assert_rejected(workspace, artifact)


@pytest.mark.parametrize(
    "name",
    [
        "report.json:stream",
        "dir:ads/evil.txt",
        "CON",
        "nul.txt",
        "dir/Com1.json",
        "lpt9 .txt",
        "evil.",
        "evil ",
        "dir./evil.txt",
        "2026-10-22T03:10:20.log",
    ],
)
def test_platform_specific_filename_rules(workspace, serve, name):
    artifact = serve(make_zip([(name, b"ordinary artifact")]))
    if os.name == "nt":
        assert_rejected(workspace, artifact)
    else:
        assert extract_to_workspace("token", artifact) == [name]
        assert (workspace.root / name).read_bytes() == b"ordinary artifact"


@pytest.mark.parametrize(
    "file_type",
    [stat.S_IFLNK, stat.S_IFIFO, stat.S_IFCHR, stat.S_IFBLK, stat.S_IFSOCK],
    ids=["symlink", "fifo", "chardev", "blockdev", "socket"],
)
def test_rejects_archive_symlinks_and_special_types(workspace, serve, file_type):
    (workspace.root / "keep.txt").write_text("old")
    link_target = str(workspace.outside / "target.txt").encode()
    artifact = serve(make_zip([("keep.txt", b"new"), ("special", link_target, (file_type | 0o777) << 16)]))

    assert_rejected(workspace, artifact)


def _parent_symlink(ws):
    os.symlink(ws.outside, ws.root / "sub")


def _dangling_parent_symlink(ws):
    os.symlink(ws.outside / "missing_dir", ws.root / "sub")


def _nested_parent_symlink(ws):
    (ws.root / "sub").mkdir()
    os.symlink(ws.outside, ws.root / "sub" / "deeper")


def _leaf_symlink(ws):
    (ws.root / "sub").mkdir()
    os.symlink(ws.outside / "target.txt", ws.root / "sub" / "deeper")


def _dangling_leaf_symlink(ws):
    (ws.root / "sub").mkdir()
    os.symlink(ws.outside / "missing.txt", ws.root / "sub" / "deeper")


@pytest.mark.parametrize(
    "setup",
    [_parent_symlink, _dangling_parent_symlink, _nested_parent_symlink, _leaf_symlink, _dangling_leaf_symlink],
    ids=["parent", "dangling-parent", "nested-parent", "leaf", "dangling-leaf"],
)
@pytest.mark.parametrize(
    "member",
    ["sub/deeper", "sub/deeper/", "sub/deeper/evil.txt"],
    ids=["file", "dir", "child"],
)
def test_rejects_existing_symlinks_on_destination_path(workspace, serve, setup, member):
    setup(workspace)
    (workspace.root / "keep.txt").write_text("old")
    artifact = serve(make_zip([("keep.txt", b"new"), (member, b"" if member.endswith("/") else b"evil")]))

    assert_rejected(workspace, artifact)


@pytest.mark.parametrize(
    "names",
    [
        ["dup.txt", "dup.txt"],
        ["a/b.txt", "a//b.txt"],
        ["a", "a/b.txt"],
        ["a/b.txt", "a"],
        ["a/", "a"],
        ["a", "a/"],
        ["Report.json", "report.JSON"],
        ["caf\u00e9.txt", "cafe\u0301.txt"],
    ],
)
def test_rejects_duplicate_and_conflicting_members(workspace, serve, names):
    (workspace.root / "keep.txt").write_text("old")
    entries = [("keep.txt", b"new")] + [(n, b"" if n.endswith("/") else b"data") for n in names]
    artifact = serve(make_zip(entries))

    assert_rejected(workspace, artifact)


@pytest.mark.parametrize(
    "existing, member",
    [("dir", "a"), ("file", "a/b.txt"), ("file", "a/")],
    ids=["file-over-dir", "dir-under-file", "dir-over-file"],
)
def test_rejects_conflicts_with_existing_destinations(workspace, serve, existing, member):
    if existing == "dir":
        (workspace.root / "a").mkdir()
        (workspace.root / "a" / "inner.txt").write_text("inner")
    else:
        (workspace.root / "a").write_text("file")
    (workspace.root / "keep.txt").write_text("old")
    artifact = serve(make_zip([("keep.txt", b"new"), (member, b"" if member.endswith("/") else b"data")]))

    assert_rejected(workspace, artifact)


def test_crc_failure_publishes_nothing(workspace, serve):
    (workspace.root / "keep.txt").write_text("old")
    payload = b"CORRUPT-PAYLOAD-0123456789"
    data = make_zip([("keep.txt", b"new"), ("dir/first.txt", b"first"), ("bad.bin", payload)])
    assert data.count(payload) == 1
    artifact = serve(data.replace(payload, payload[::-1]))

    assert_rejected(workspace, artifact, CORRUPTED)


@pytest.mark.parametrize(
    "content",
    [b"not a zip file", make_zip([("keep.txt", b"new")])[:-10]],
    ids=["garbage", "truncated"],
)
def test_corrupt_archive_publishes_nothing(workspace, serve, content):
    (workspace.root / "keep.txt").write_text("old")

    assert_rejected(workspace, serve(content), CORRUPTED)


def _collection(items):
    collection = MagicMock()
    collection.totalCount = len(items)
    collection.__getitem__.side_effect = items.__getitem__
    collection.__iter__.side_effect = lambda: iter(items)
    return collection


def _invoke_ci_artifact(serve, content, *, worktree_root=".", extra_artifacts=()):
    from recce.cli import cli

    artifact = serve(content)
    artifact.name = "recce-artifact"
    workflow_run = MagicMock()
    workflow_run.get_artifacts.return_value = _collection([artifact, *extra_artifacts])
    github_repo = MagicMock()
    github_repo.get_pulls.return_value = _collection([MagicMock()])
    github_repo.get_workflow_runs.return_value = _collection([workflow_run])
    git_repo = MagicMock()
    git_repo.working_tree_dir = str(Path(worktree_root).resolve()) if worktree_root is not None else None
    git_repo.active_branch.name = "feature"
    git_repo.remote.return_value.url = "git@github.com:owner/repo.git"

    with patch("git.Repo", return_value=git_repo), patch("github.Github") as github_class:
        github_class.return_value.get_repo.return_value = github_repo
        return CliRunner().invoke(
            cli, ["github", "artifact", "--github-token", "t", "--github-repo", "owner/repo"], catch_exceptions=False
        )


def test_ci_artifact_command_extracts_artifact(workspace, serve, monkeypatch):
    nested = workspace.root / "nested"
    nested.mkdir()
    monkeypatch.chdir(nested)
    result = _invoke_ci_artifact(serve, make_zip([("target/manifest.json", b"{}")]), worktree_root=workspace.root)

    assert result.exit_code == 0, result.output
    outputs = list(workspace.root.glob(".recce-github-artifact-*"))
    assert len(outputs) == 1
    assert (outputs[0] / "manifest.json").read_bytes() == b"{}"
    assert str(outputs[0]) in result.output.replace("\n", "")
    assert "manifest.json" in result.output
    assert not (nested / "target").exists()


def test_ci_artifact_command_fails_on_unsafe_artifact(workspace, serve):
    os.symlink(workspace.outside, workspace.root / "target")
    before = snapshot(workspace.tmp)

    result = _invoke_ci_artifact(serve, make_zip([("target/target.txt", b"evil"), ("target/new.txt", b"evil")]))

    assert result.exit_code != 0
    assert "Error" in result.output
    assert snapshot(workspace.tmp) == before


# Download policy regressions: all ZIP and HTTP data below are local test doubles.
@pytest.mark.parametrize(
    "name",
    [
        ".git/config",
        ".git/hooks/post-checkout",
        ".GiT/manifest.json",
        "GIT~1/config",
        "git~1/manifest.json",
        "target/GiT~1/manifest.json",
        "recce.yml",
        "profiles.yml",
        ".env",
        "target/.hidden/manifest.json",
        "unknown.json",
        "manifest.txt",
        "Manifest.json",
        "other/manifest.json",
        "target/deep/manifest.json",
        "unexpected/",
    ],
)
def test_rejects_disallowed_members_before_publication(workspace, serve, name):
    (workspace.root / "manifest.json").write_bytes(b"original")
    artifact = serve(make_zip([("catalog.json", b"{}"), (name, b"untrusted")]))
    before = snapshot(workspace.tmp)
    with patch.object(github_module.os, "replace", wraps=os.replace) as publish:
        with pytest.raises(ValueError):
            download_artifact("token", artifact)
    publish.assert_not_called()
    assert snapshot(workspace.tmp) == before


@pytest.mark.parametrize(
    "entries", [[], [("target/", b"")], [("manifest.json", b"{}"), ("target/catalog.json", b"{}")]]
)
def test_rejects_empty_or_mixed_layouts(workspace, serve, entries):
    before = snapshot(workspace.tmp)
    with pytest.raises(ValueError):
        download_artifact("token", serve(make_zip(entries)))
    assert snapshot(workspace.tmp) == before


@pytest.mark.parametrize("prefix", ["", "target/"])
def test_download_publishes_only_to_fresh_subdirectory(workspace, serve, prefix):
    (workspace.root / "manifest.json").write_bytes(b"original")
    (workspace.root / "target").mkdir()
    (workspace.root / "target" / "manifest.json").write_bytes(b"original target")
    os.link(workspace.outside / "target.txt", workspace.root / "catalog.json")
    names = [
        "manifest.json",
        "catalog.json",
        "run_results.json",
        "sources.json",
        "semantic_manifest.json",
        "recce_state.json",
    ]
    entries = [
        (prefix + name, b"{}", attr)
        for name, attr in zip(names, [FILE_ATTR, 0, 0o644 << 16, FILE_ATTR, FILE_ATTR, FILE_ATTR])
    ]
    if prefix:
        entries.insert(0, ("target/", b"", DIR_ATTR))
    artifact = serve(make_zip(entries))
    before = snapshot(workspace.tmp)

    result = download_artifact("token", artifact)

    assert len(list(workspace.root.glob(".recce-github-artifact-*"))) == 1
    output, files = result
    output = Path(output)
    assert output.parent == workspace.root
    assert output.name.startswith(".recce-github-artifact-")
    assert files == names
    assert sorted(p.name for p in output.iterdir()) == sorted(names)
    assert all((output / name).read_bytes() == b"{}" for name in names)
    after = snapshot(workspace.tmp)
    assert {k: after[k] for k in before} == before
    second_output, _ = download_artifact("token", artifact)
    assert Path(second_output) != output
    assert (output / "manifest.json").read_bytes() == b"{}"


@pytest.mark.parametrize("budget", ["bytes", "members"])
def test_rejects_archive_over_budget(workspace, serve, monkeypatch, budget):
    entries = [("target/", b""), ("target/manifest.json", b"123"), ("target/catalog.json", b"456")]
    monkeypatch.setattr(github_module, "MAX_ARCHIVE_BYTES", 6, raising=False)
    monkeypatch.setattr(github_module, "MAX_ARCHIVE_MEMBERS", 3, raising=False)
    artifact = serve(make_zip(entries))
    # Equality is allowed; every member, including the directory, counts.
    download_artifact("token", artifact)
    before = snapshot(workspace.tmp)
    monkeypatch.setattr(
        github_module,
        "MAX_ARCHIVE_BYTES" if budget == "bytes" else "MAX_ARCHIVE_MEMBERS",
        5 if budget == "bytes" else 2,
        raising=False,
    )
    with pytest.raises(ValueError, match="limit"):
        download_artifact("token", artifact)
    assert snapshot(workspace.tmp) == before


def test_staging_enforces_actual_byte_budget(workspace, serve, monkeypatch):
    artifact = serve(make_zip([("manifest.json", b"12"), ("catalog.json", b"34")]))
    monkeypatch.setattr(github_module, "MAX_ARCHIVE_BYTES", 4, raising=False)
    before = snapshot(workspace.tmp)
    # Deliberately under-report the total in the ZIP metadata, as a hostile source could.
    with patch.object(zipfile.ZipFile, "open", side_effect=lambda info: io.BytesIO(b"123")):
        with pytest.raises(ValueError, match="limit"):
            download_artifact("token", artifact)
    assert snapshot(workspace.tmp) == before


def test_publish_failure_leaves_no_partial_output(workspace, serve):
    artifact = serve(make_zip([("manifest.json", b"{}"), ("catalog.json", b"{}")]))
    before = snapshot(workspace.tmp)
    with patch.object(github_module.os, "rename", side_effect=OSError("publication failed")):
        with pytest.raises(OSError, match="publication failed"):
            download_artifact("token", artifact)
    assert snapshot(workspace.tmp) == before


def test_download_streams_with_explicit_timeout(workspace, serve):
    artifact = serve(make_zip([("manifest.json", b"{}")]))
    download_artifact("token", artifact)
    options = github_module.requests.get.call_args.kwargs
    assert options.get("stream") is True
    assert len(options["timeout"]) == 2
    assert all(0 < seconds <= 60 for seconds in options["timeout"])
    github_module.requests.get.return_value.__exit__.assert_called_once()


def test_download_rejects_oversized_response_before_opening_zip(workspace, serve, monkeypatch):
    content = make_zip([("manifest.json", b"{}")])
    artifact = serve(content)
    monkeypatch.setattr(github_module, "MAX_DOWNLOAD_BYTES", len(content), raising=False)
    download_artifact("token", artifact)  # exact boundary
    before = snapshot(workspace.tmp)
    monkeypatch.setattr(github_module, "MAX_DOWNLOAD_BYTES", len(content) - 1, raising=False)
    with patch.object(github_module.zipfile, "ZipFile", wraps=zipfile.ZipFile) as open_zip:
        with pytest.raises(ValueError, match="limit"):
            download_artifact("token", artifact)
        open_zip.assert_not_called()
    assert snapshot(workspace.tmp) == before


def test_ci_artifact_command_reports_timeout_without_url(workspace, serve):
    def timeout_serve(content):
        artifact = serve(content)
        github_module.requests.get.side_effect = requests.Timeout("https://example.invalid/private-download")
        return artifact

    result = _invoke_ci_artifact(timeout_serve, make_zip([("manifest.json", b"{}")]))
    assert result.exit_code == 1
    assert "HTTP" in result.output
    assert "https://example.invalid" not in result.output
    assert snapshot(workspace.root) == {}


def test_ci_artifact_command_preserves_artifact_and_run_selection(workspace, serve):
    def multiple_serve(content):
        artifact = serve(content)
        # Keep serving a ZIP for each existing artifact in the selected run.
        return artifact

    extra = SimpleNamespace(name="separately-named", archive_download_url="https://example.invalid/other.zip")
    result = _invoke_ci_artifact(multiple_serve, make_zip([("manifest.json", b"{}")]), extra_artifacts=[extra])
    assert result.exit_code == 0, result.output
    outputs = list(workspace.root.glob(".recce-github-artifact-*"))
    assert len(outputs) == 2
    assert all((output / "manifest.json").read_bytes() == b"{}" for output in outputs)
    assert github_module.requests.get.call_count == 2


def test_ci_artifact_help_describes_isolated_output():
    from recce.cli import cli

    result = CliRunner().invoke(cli, ["github", "artifact", "--help"])
    assert result.exit_code == 0
    assert "isolated" in result.output
    assert "--target-path" in result.output


def test_ci_artifact_command_requires_worktree(workspace, serve):
    result = _invoke_ci_artifact(serve, make_zip([("manifest.json", b"{}")]), worktree_root=None)
    assert result.exit_code == 1
    assert "worktree" in result.output
    github_module.requests.get.assert_not_called()
    assert snapshot(workspace.root) == {}


@pytest.mark.parametrize("cached", [True, False], ids=["cached-tempdir", "uncached-TMPDIR"])
def test_invalid_input_causes_no_worktree_writes(workspace, serve, monkeypatch, cached):
    local_temp = workspace.root / "tmp"
    local_temp.mkdir()
    monkeypatch.setenv("TMPDIR", str(local_temp))
    monkeypatch.setattr(tempfile, "tempdir", str(local_temp) if cached else None)
    artifact = serve(make_zip([("./manifest.json", b"{}")]))
    writes = []
    mkdir, open_fd = os.mkdir, os.open

    def record(path):
        path = Path(path).resolve()
        if path.is_relative_to(workspace.root):
            writes.append(str(path.relative_to(workspace.root)))

    def observe_mkdir(path, *args, **kwargs):
        result = mkdir(path, *args, **kwargs)
        record(path)
        return result

    def observe_open(path, flags, *args, **kwargs):
        fd = open_fd(path, flags, *args, **kwargs)
        if flags & (os.O_CREAT | os.O_WRONLY | os.O_RDWR):
            record(path)
        return fd

    monkeypatch.setattr(os, "mkdir", observe_mkdir)
    monkeypatch.setattr(os, "open", observe_open)
    with pytest.raises(ValueError):
        download_artifact("token", artifact, worktree_root=str(workspace.root))
    assert list(local_temp.iterdir()) == []
    assert not writes, f"worktree writes before rejection: {writes}"


def test_download_requires_temporary_parent_outside_worktree(workspace, serve, monkeypatch):
    artifact = serve(make_zip([("manifest.json", b"{}")]))
    monkeypatch.setattr(tempfile, "tempdir", str(workspace.root))
    monkeypatch.setattr(tempfile, "_candidate_tempdir_list", lambda: [str(workspace.root)])
    with patch.object(os, "mkdir", wraps=os.mkdir) as mkdir, patch.object(os, "open", wraps=os.open) as open_fd:
        with pytest.raises(OSError, match="temporary directory outside"):
            download_artifact("token", artifact)
    mkdir.assert_not_called()
    open_fd.assert_not_called()
    github_module.requests.get.assert_not_called()


def test_invalid_archive_never_creates_worktree_staging(workspace, serve):
    artifact = serve(make_zip([("./manifest.json", b"{}")]))
    with patch.object(os, "mkdir", wraps=os.mkdir) as mkdir, patch.object(os, "open", wraps=os.open) as open_fd:
        with pytest.raises(ValueError):
            download_artifact("token", artifact)
    writes = [call.args[0] for call in mkdir.call_args_list + open_fd.call_args_list]
    assert not [path for path in writes if Path(path).resolve().is_relative_to(workspace.root)]
    assert snapshot(workspace.root) == {}


@pytest.mark.parametrize(
    "entries",
    [
        [("target-base/manifest.json", b"{}"), ("target-base/catalog.json", b"[]")],
        [("target/manifest.json", b"{}"), ("target/catalog.json", b"[]"), ("recce_state.json", b'{"state":1}')],
        [("target-base/", b""), ("target-base/manifest.json", b"{}"), ("recce_state.json", b'{"state":1}')],
    ],
    ids=["baseline-wrapper", "wrapped-dbt-and-root-state", "baseline-directory-and-root-state"],
)
def test_download_accepts_supported_layouts(workspace, serve, entries):
    output, names = download_artifact("token", serve(make_zip(entries)), worktree_root=str(workspace.root))
    output = Path(output)
    assert output.parent == workspace.root
    assert set(workspace.root.iterdir()) == {output}
    expected = {Path(name).name: content for name, content in entries if not name.endswith("/")}
    assert set(names) == set(expected)
    assert {path.name: path.read_bytes() for path in output.iterdir()} == expected


@pytest.mark.parametrize("prefix", ["target/", "target-base/"])
def test_rejects_flat_output_collision_before_extraction(workspace, serve, prefix):
    artifact = serve(make_zip([(prefix + "recce_state.json", b"first"), ("recce_state.json", b"second")]))
    with patch.object(github_module, "_extract_zip", wraps=github_module._extract_zip) as extract:
        with pytest.raises(ValueError, match="Duplicate destination"):
            download_artifact("token", artifact)
    extract.assert_not_called()
    assert snapshot(workspace.root) == {}


def test_declared_byte_limit_rejected_before_opening_member(workspace, serve, monkeypatch):
    artifact = serve(make_zip([("manifest.json", b"123"), ("catalog.json", b"456")]))
    monkeypatch.setattr(github_module, "MAX_ARCHIVE_BYTES", 5)
    with patch.object(
        zipfile.ZipFile, "open", side_effect=AssertionError("Member opened before size preflight")
    ) as member:
        with pytest.raises(ValueError, match="uncompressed byte limit"):
            download_artifact("token", artifact)
    member.assert_not_called()
    assert snapshot(workspace.root) == {}


def test_download_counts_cumulative_http_chunks(workspace, serve, monkeypatch):
    content = make_zip([("manifest.json", b"{}")])
    artifact = serve(content)
    response = github_module.requests.get.return_value.__enter__.return_value
    response.iter_content.side_effect = lambda chunk_size: iter([content[:20], b"", content[20:]])
    monkeypatch.setattr(github_module, "MAX_DOWNLOAD_BYTES", len(content))
    download_artifact("token", artifact)
    before = snapshot(workspace.root)
    monkeypatch.setattr(github_module, "MAX_DOWNLOAD_BYTES", len(content) - 1)
    with patch.object(github_module.zipfile, "ZipFile", wraps=zipfile.ZipFile) as open_zip:
        with pytest.raises(ValueError, match="compressed byte limit"):
            download_artifact("token", artifact)
        open_zip.assert_not_called()
    assert snapshot(workspace.root) == before


@pytest.mark.parametrize(
    "directory,payload,filename",
    [
        ("unexpected/", b"", "recce_state.json"),
        ("target/deep/", b"", "target/manifest.json"),
        ("target/", b"hidden payload", "target/manifest.json"),
    ],
    ids=["unexpected-wrapper", "nested-directory", "directory-payload"],
)
def test_rejects_invalid_directory_entries(workspace, serve, directory, payload, filename):
    artifact = serve(make_zip([(directory, payload), (filename, b"{}")]))
    with pytest.raises(ValueError, match="Disallowed directory"):
        download_artifact("token", artifact)
    assert snapshot(workspace.root) == {}


@pytest.mark.parametrize("anchor", ["missing", "file"])
def test_rejects_invalid_output_anchor_before_download(workspace, serve, anchor):
    root = workspace.root / anchor
    if anchor == "file":
        root.write_bytes(b"keep")
    artifact = serve(make_zip([("manifest.json", b"{}")]))
    before = snapshot(workspace.root)
    with patch.object(os, "mkdir", wraps=os.mkdir) as mkdir, patch.object(os, "open", wraps=os.open) as open_fd:
        with pytest.raises(ValueError, match="existing worktree directory"):
            download_artifact("token", artifact, worktree_root=str(root))
    mkdir.assert_not_called()
    open_fd.assert_not_called()
    github_module.requests.get.assert_not_called()
    assert snapshot(workspace.root) == before


def test_rejects_existing_output_collision(workspace, serve, monkeypatch):
    monkeypatch.setattr(github_module.uuid, "uuid4", lambda: SimpleNamespace(hex="collision"))
    output = workspace.root / ".recce-github-artifact-collision"
    output.mkdir()
    before = snapshot(workspace.root)
    artifact = serve(make_zip([("manifest.json", b"{}")]))
    with pytest.raises(FileExistsError, match="Artifact output directory already exists"):
        download_artifact("token", artifact)
    assert snapshot(workspace.root) == before


def test_ci_artifact_command_renders_literal_artifact_name(workspace, serve):
    extra = SimpleNamespace(name="[bold]artifact[/bold]", archive_download_url="https://example.invalid/other.zip")
    result = _invoke_ci_artifact(serve, make_zip([("manifest.json", b"{}")]), extra_artifacts=[extra])
    assert result.exit_code == 0, result.output
    assert "Artifact: [bold]artifact[/bold]" in result.output


def test_ci_artifact_command_rejects_http_status_failure(workspace, serve):
    def status_serve(content):
        artifact = serve(content)
        response = github_module.requests.get.return_value.__enter__.return_value
        response.raise_for_status.side_effect = requests.HTTPError("https://example.invalid/private-download")
        return artifact

    result = _invoke_ci_artifact(status_serve, make_zip([("manifest.json", b"{}")]))
    assert result.exit_code == 1, result.output
    assert "HTTP download failed" in result.output
    assert "https://example.invalid" not in result.output
    response = github_module.requests.get.return_value.__enter__.return_value
    response.iter_content.assert_not_called()
    response.__exit__.assert_called_once()
    assert snapshot(workspace.root) == {}
