"""Regression tests for dbt artifact upload/download archive handling.

These exercise the real ``archive_artifacts``/``upload_dbt_artifacts`` and
``download_dbt_artifacts`` functions; only network, Recce Cloud and git are mocked.
"""

import gzip
import io
import json
import os
import tarfile
from unittest.mock import MagicMock, patch

import pytest
from rich.console import Console

from recce.artifact import download_dbt_artifacts, upload_dbt_artifacts

MANIFEST = {"metadata": {"dbt_version": "1.8.0", "adapter_type": "duckdb"}, "nodes": {}}
CATALOG = {"metadata": {"dbt_version": "1.8.0"}, "nodes": {}}
MANIFEST_BYTES = json.dumps(MANIFEST).encode()
CATALOG_BYTES = json.dumps(CATALOG).encode()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _response(content: bytes, status: int = 200):
    resp = MagicMock()
    resp.status_code = status
    resp.content = content
    resp.text = "" if status == 200 else "error"
    return resp


def _download(target, payload: bytes, force: bool = False):
    cloud = MagicMock()
    cloud.get_download_presigned_url_by_github_repo_with_tags.return_value = ("https://example.invalid/dl", {})
    with (
        patch("recce.artifact.hosting_repo", return_value="org/repo"),
        patch("recce.artifact.RecceCloud", return_value=cloud),
        patch("recce.artifact.requests.get", return_value=_response(payload)),
    ):
        return download_dbt_artifacts(str(target), branch="main", token="tok", password="pw", force=force)


def _file_member(name: str, data: bytes, **attrs):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    for key, value in attrs.items():
        setattr(info, key, value)
    return info, io.BytesIO(data)


def _tar_gz(members, fmt=tarfile.PAX_FORMAT) -> bytes:
    """Build a gzip tarball from ``(TarInfo, fileobj_or_None)`` pairs."""
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w", format=fmt) as tar:
        for info, fileobj in members:
            tar.addfile(info, fileobj)
    return gzip.compress(raw.getvalue())


def _good_members():
    return [_file_member("manifest.json", MANIFEST_BYTES), _file_member("catalog.json", CATALOG_BYTES)]


def _link(name: str, linkname: str, kind=tarfile.SYMTYPE):
    info = tarfile.TarInfo(name)
    info.type = kind
    info.linkname = linkname
    return info, None


def _special(name: str, kind):
    info = tarfile.TarInfo(name)
    info.type = kind
    return info, None


def _snapshot(root):
    """All paths (relative) under root, including symlinks and dirs, not following links."""
    result = set()
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        for name in dirnames + filenames:
            result.add(os.path.relpath(os.path.join(dirpath, name), root))
    return result


@pytest.fixture
def layout(tmp_path):
    """Isolated layout: ``work/`` holds the target, ``outside/`` is a hostile-target sandbox."""
    work = tmp_path / "work"
    outside = tmp_path / "outside"
    work.mkdir()
    outside.mkdir()
    return tmp_path, work, outside, work / "target"


def _assert_rejected(tmp_path, work, target, payload, force=False, before=None):
    before = _snapshot(tmp_path) if before is None else before
    with pytest.raises(Exception):
        _download(target, payload, force=force)
    # nothing escaped, no staging or partial target left behind
    assert _snapshot(tmp_path) == before


# ---------------------------------------------------------------------------
# roundtrip through the real uploader
# ---------------------------------------------------------------------------


def _upload_capture(source_dir) -> bytes:
    captured = {}

    def fake_put(url, data=None, headers=None):
        captured["data"] = data
        return _response(b"", 200)

    cloud = MagicMock()
    cloud.get_presigned_url_by_github_repo.return_value = "https://example.invalid/up"
    with (
        patch("recce.artifact.current_branch", return_value="main"),
        patch("recce.artifact.hosting_repo", return_value="org/repo"),
        patch("recce.artifact.commit_hash_from_branch", return_value="abc"),
        patch("recce.artifact.RecceCloud", return_value=cloud),
        patch("recce.artifact.requests.put", side_effect=fake_put),
    ):
        upload_dbt_artifacts(str(source_dir), branch="main", token="tok", password="pw")
    return captured["data"]


def test_roundtrip_real_upload_and_download(layout):
    tmp_path, work, _, target = layout
    src = tmp_path / "src"
    src.mkdir()
    (src / "manifest.json").write_bytes(MANIFEST_BYTES)
    (src / "catalog.json").write_bytes(CATALOG_BYTES)

    payload = _upload_capture(src)
    assert _download(target, payload) == 0

    assert sorted(os.listdir(target)) == ["catalog.json", "manifest.json"]
    assert (target / "manifest.json").read_bytes() == MANIFEST_BYTES
    assert (target / "catalog.json").read_bytes() == CATALOG_BYTES
    assert not (target / "manifest.json").is_symlink()
    # staging directory cleaned up
    assert os.listdir(work) == ["target"]


def test_roundtrip_symlinked_source_files(layout):
    """Local symlinked artifacts are archived as regular files and download cleanly."""
    tmp_path, work, _, target = layout
    real = tmp_path / "real"
    real.mkdir()
    (real / "manifest.json").write_bytes(MANIFEST_BYTES)
    (real / "catalog.json").write_bytes(CATALOG_BYTES)
    src = tmp_path / "src"
    src.mkdir()
    os.symlink(real / "manifest.json", src / "manifest.json")
    os.symlink(real / "catalog.json", src / "catalog.json")

    payload = _upload_capture(src)
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tar:
        assert all(m.isreg() for m in tar.getmembers())

    assert _download(target, payload) == 0
    assert (target / "manifest.json").read_bytes() == MANIFEST_BYTES
    assert (target / "catalog.json").read_bytes() == CATALOG_BYTES
    assert not (target / "manifest.json").is_symlink()
    assert not (target / "catalog.json").is_symlink()
    assert os.listdir(work) == ["target"]


# ---------------------------------------------------------------------------
# hostile archives
# ---------------------------------------------------------------------------


def test_rejects_relative_traversal(layout):
    tmp_path, work, outside, target = layout
    payload = _tar_gz(_good_members() + [_file_member("../../outside/evil.json", b"pwned")])
    _assert_rejected(tmp_path, work, target, payload)
    assert not (outside / "evil.json").exists()


def test_rejects_absolute_path(layout):
    tmp_path, work, outside, target = layout
    hostile = str(outside / "abs.json")
    payload = _tar_gz(_good_members() + [_file_member(hostile, b"pwned")])
    _assert_rejected(tmp_path, work, target, payload)
    assert not os.path.exists(hostile)


@pytest.mark.parametrize("name", ["..\\..\\outside\\win.json", "C:\\outside\\win.json", "sub\\manifest.json"])
def test_rejects_windows_style_paths(layout, name):
    tmp_path, work, _, target = layout
    payload = _tar_gz(_good_members() + [_file_member(name, b"pwned")])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_pax_path_override(layout):
    tmp_path, work, outside, target = layout
    info, data = _file_member("manifest.json", b"pwned")
    info.pax_headers = {"path": "../../outside/pax.json"}
    payload = _tar_gz([(info, data), _file_member("catalog.json", CATALOG_BYTES)])
    _assert_rejected(tmp_path, work, target, payload)
    assert not (outside / "pax.json").exists()


def test_rejects_nested_expected_name(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz([_file_member("sub/manifest.json", MANIFEST_BYTES), _file_member("catalog.json", CATALOG_BYTES)])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_symlink_to_outside(layout):
    tmp_path, work, outside, target = layout
    secret = outside / "secret.json"
    secret.write_bytes(b"secret")
    payload = _tar_gz([_link("manifest.json", str(secret)), _file_member("catalog.json", CATALOG_BYTES)])
    _assert_rejected(tmp_path, work, target, payload)
    assert secret.read_bytes() == b"secret"


def test_rejects_symlink_chain_write_through(layout):
    """A symlink followed by a regular file of the same name must not write through the link."""
    tmp_path, work, outside, target = layout
    victim = outside / "victim.json"
    victim.write_bytes(b"original")
    payload = _tar_gz(
        [
            _link("manifest.json", str(victim)),
            _file_member("manifest.json", b"overwritten"),
            _file_member("catalog.json", CATALOG_BYTES),
        ]
    )
    _assert_rejected(tmp_path, work, target, payload)
    assert victim.read_bytes() == b"original"


def test_rejects_directory_symlink_chain(layout):
    tmp_path, work, outside, target = layout
    payload = _tar_gz(
        [
            _link("dirlink", str(outside)),
            _link("hop", "dirlink"),
            _file_member("hop/escaped.json", b"pwned"),
        ]
        + _good_members()
    )
    _assert_rejected(tmp_path, work, target, payload)
    assert not (outside / "escaped.json").exists()


def test_rejects_internal_symlink(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz([_file_member("manifest.json", MANIFEST_BYTES), _link("catalog.json", "manifest.json")])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_hardlink_to_outside(layout):
    tmp_path, work, outside, target = layout
    secret = outside / "secret.json"
    secret.write_bytes(b"secret")
    payload = _tar_gz(
        [_link("manifest.json", str(secret), kind=tarfile.LNKTYPE), _file_member("catalog.json", CATALOG_BYTES)]
    )
    _assert_rejected(tmp_path, work, target, payload)
    assert secret.read_bytes() == b"secret"


def test_rejects_internal_hardlink_chain(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz(
        [
            _file_member("manifest.json", MANIFEST_BYTES),
            _link("catalog.json", "manifest.json", kind=tarfile.LNKTYPE),
        ]
    )
    _assert_rejected(tmp_path, work, target, payload)


@pytest.mark.parametrize(
    "kind",
    [tarfile.FIFOTYPE, tarfile.CHRTYPE, tarfile.BLKTYPE, tarfile.DIRTYPE, tarfile.CONTTYPE],
    ids=["fifo", "chr", "blk", "dir", "cont"],
)
def test_rejects_special_member_with_expected_name(layout, kind):
    tmp_path, work, _, target = layout
    payload = _tar_gz([_special("manifest.json", kind), _file_member("catalog.json", CATALOG_BYTES)])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_sparse_member(layout):
    tmp_path, work, _, target = layout
    info, data = _file_member("manifest.json", MANIFEST_BYTES)
    info.type = tarfile.GNUTYPE_SPARSE
    payload = _tar_gz([(info, data), _file_member("catalog.json", CATALOG_BYTES)], fmt=tarfile.GNU_FORMAT)
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_duplicate_member(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz(_good_members() + [_file_member("manifest.json", b"{}")])
    _assert_rejected(tmp_path, work, target, payload)


@pytest.mark.parametrize("keep", ["manifest.json", "catalog.json"])
def test_rejects_missing_member(layout, keep):
    tmp_path, work, _, target = layout
    payload = _tar_gz([m for m in _good_members() if m[0].name == keep])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_empty_archive(layout):
    tmp_path, work, _, target = layout
    _assert_rejected(tmp_path, work, target, _tar_gz([]))


def test_rejects_unexpected_extra_file(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz(_good_members() + [_file_member("run_results.json", b"{}")])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_corrupt_archive(layout):
    tmp_path, work, _, target = layout
    _assert_rejected(tmp_path, work, target, b"definitely not a tarball" * 50)


def test_rejects_truncated_archive(layout):
    tmp_path, work, _, target = layout
    big = json.dumps({"metadata": {"dbt_version": "1.8.0"}, "pad": "x" * 200_000}).encode()
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w") as tar:
        for name, data in (("manifest.json", big), ("catalog.json", CATALOG_BYTES)):
            info, fobj = _file_member(name, data)
            tar.addfile(info, fobj)
    # uncompressed truncation mid-member, then gzip so the transport format is valid
    payload = gzip.compress(raw.getvalue()[:4096])
    _assert_rejected(tmp_path, work, target, payload)


def test_rejects_truncated_gzip_stream(layout):
    tmp_path, work, _, target = layout
    payload = _tar_gz(_good_members())
    _assert_rejected(tmp_path, work, target, payload[: len(payload) // 2])


# ---------------------------------------------------------------------------
# target handling
# ---------------------------------------------------------------------------


def test_no_force_existing_target_untouched(layout):
    tmp_path, work, _, target = layout
    target.mkdir()
    (target / "keep.txt").write_bytes(b"keep")
    before = _snapshot(tmp_path)
    with pytest.raises(Exception):
        _download(target, _tar_gz(_good_members()), force=False)
    assert _snapshot(tmp_path) == before
    assert (target / "keep.txt").read_bytes() == b"keep"


def test_force_valid_replaces_target(layout):
    _, work, _, target = layout
    target.mkdir()
    (target / "stale.txt").write_bytes(b"stale")
    (target / "manifest.json").write_bytes(b"old")
    assert _download(target, _tar_gz(_good_members()), force=True) == 0
    assert sorted(os.listdir(target)) == ["catalog.json", "manifest.json"]
    assert (target / "manifest.json").read_bytes() == MANIFEST_BYTES
    assert os.listdir(work) == ["target"]


@pytest.mark.parametrize(
    "payload_factory",
    [
        lambda outside: _tar_gz(_good_members() + [_file_member("../evil.json", b"x")]),
        lambda outside: _tar_gz([_link("manifest.json", str(outside)), _file_member("catalog.json", CATALOG_BYTES)]),
        lambda outside: _tar_gz([_file_member("manifest.json", MANIFEST_BYTES)]),
        lambda outside: b"corrupt" * 10,
    ],
    ids=["traversal", "symlink", "missing", "corrupt"],
)
def test_force_invalid_preserves_existing_target(layout, payload_factory):
    tmp_path, work, outside, target = layout
    target.mkdir()
    (target / "manifest.json").write_bytes(b"previous manifest")
    (target / "catalog.json").write_bytes(b"previous catalog")
    _assert_rejected(tmp_path, work, target, payload_factory(outside), force=True)
    assert (target / "manifest.json").read_bytes() == b"previous manifest"
    assert (target / "catalog.json").read_bytes() == b"previous catalog"


@pytest.mark.parametrize("force", [True, False])
def test_rejects_symlink_destination(layout, force):
    tmp_path, work, outside, target = layout
    victim_dir = outside / "victim"
    victim_dir.mkdir()
    (victim_dir / "keep.txt").write_bytes(b"keep")
    os.symlink(victim_dir, target)
    _assert_rejected(tmp_path, work, target, _tar_gz(_good_members()), force=force)
    assert target.is_symlink()
    assert os.readlink(target) == str(victim_dir)
    assert sorted(os.listdir(victim_dir)) == ["keep.txt"]


def test_rejects_dangling_symlink_destination(layout):
    tmp_path, work, outside, target = layout
    os.symlink(outside / "does-not-exist", target)
    _assert_rejected(tmp_path, work, target, _tar_gz(_good_members()), force=True)
    assert not (outside / "does-not-exist").exists()
    assert target.is_symlink()


# ---------------------------------------------------------------------------
# CLI failure reporting
# ---------------------------------------------------------------------------


def test_cli_download_reports_rejected_archive(layout):
    from recce.cli import _download_artifacts

    tmp_path, work, outside, target = layout
    payload = _tar_gz(_good_members() + [_file_member("../../outside/evil.json", b"pwned")])
    buf = io.StringIO()
    console = Console(file=buf, width=200)
    cloud = MagicMock()
    cloud.get_download_presigned_url_by_github_repo_with_tags.return_value = ("https://example.invalid/dl", {})
    before = _snapshot(tmp_path)
    with (
        patch("recce.artifact.hosting_repo", return_value="org/repo"),
        patch("recce.artifact.RecceCloud", return_value=cloud),
        patch("recce.artifact.requests.get", return_value=_response(payload)),
    ):
        rc = _download_artifacts("main", "tok", console, {"force": False}, "pw", str(target))

    assert rc == 1
    assert "Failed to Download" in buf.getvalue()
    assert _snapshot(tmp_path) == before
    assert not (outside / "evil.json").exists()
