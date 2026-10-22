import io
import os
import stat
import warnings
import zipfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from click.testing import CliRunner

import recce.github as github_module
from recce.github import download_artifact

FILE_ATTR = (stat.S_IFREG | 0o644) << 16
DIR_ATTR = ((stat.S_IFDIR | 0o755) << 16) | 0x10
REJECTED = (ValueError, OSError)
CORRUPTED = (ValueError, OSError, zipfile.BadZipFile)


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
        response.raise_for_status.return_value = None
        monkeypatch.setattr(github_module.requests, "get", MagicMock(return_value=response))
        return SimpleNamespace(archive_download_url="https://example.invalid/artifact.zip")

    return _serve


def assert_rejected(workspace, artifact, errors=REJECTED):
    before = snapshot(workspace.tmp)
    with pytest.raises(errors):
        download_artifact("token", artifact)
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

    names = download_artifact("token", artifact)

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

    download_artifact("token", artifact)

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
        assert download_artifact("token", artifact) == [name]
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


def _invoke_ci_artifact(serve, content):
    from recce.cli import cli

    artifact = serve(content)
    artifact.name = "recce-artifact"
    workflow_run = MagicMock()
    workflow_run.get_artifacts.return_value = _collection([artifact])
    github_repo = MagicMock()
    github_repo.get_pulls.return_value = _collection([MagicMock()])
    github_repo.get_workflow_runs.return_value = _collection([workflow_run])
    git_repo = MagicMock()
    git_repo.active_branch.name = "feature"
    git_repo.remote.return_value.url = "git@github.com:owner/repo.git"

    with patch("git.Repo", return_value=git_repo), patch("github.Github") as github_class:
        github_class.return_value.get_repo.return_value = github_repo
        return CliRunner().invoke(
            cli, ["github", "artifact", "--github-token", "t", "--github-repo", "owner/repo"], catch_exceptions=False
        )


def test_ci_artifact_command_extracts_artifact(workspace, serve):
    result = _invoke_ci_artifact(serve, make_zip([("target/manifest.json", b"{}")]))

    assert result.exit_code == 0, result.output
    assert (workspace.root / "target" / "manifest.json").read_bytes() == b"{}"


def test_ci_artifact_command_fails_on_unsafe_artifact(workspace, serve):
    os.symlink(workspace.outside, workspace.root / "target")
    before = snapshot(workspace.tmp)

    result = _invoke_ci_artifact(serve, make_zip([("target/target.txt", b"evil"), ("target/new.txt", b"evil")]))

    assert result.exit_code != 0
    assert "Error" in result.output
    assert snapshot(workspace.tmp) == before
