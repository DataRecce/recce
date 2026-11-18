import ntpath
import os
import re
import shutil
import stat
import tempfile
import unicodedata
import uuid
import zipfile
from datetime import datetime
from typing import List, Optional, Tuple

import requests
from github import Artifact, Auth, Github, PullRequest, UnknownObjectException

from recce.git import current_branch, hosting_repo

# Windows device names, matched like ntpath.isreserved (Python 3.13+): case-insensitive,
# ignoring any extension and trailing spaces before it ("con .txt" is still CON).
_WINDOWS_RESERVED_NAMES = frozenset(
    ["CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$"]
    + [f"{device}{suffix}" for device in ("COM", "LPT") for suffix in "123456789\u00b9\u00b2\u00b3"]
)


# Bounds apply per workflow artifact, including explicit directory members.
MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_ARCHIVE_MEMBERS = 16
MAX_DOWNLOAD_BYTES = 128 * 1024 * 1024
ARTIFACT_DOWNLOAD_TIMEOUT = (5, 30)
_ALLOWED_ARTIFACT_FILENAMES = frozenset(
    ("manifest.json", "catalog.json", "run_results.json", "sources.json", "semantic_manifest.json", "recce_state.json")
)


def _bounded_archive_members(archive: zipfile.ZipFile) -> List[zipfile.ZipInfo]:
    members = archive.infolist()
    if len(members) > MAX_ARCHIVE_MEMBERS:
        raise ValueError("Artifact archive exceeds member count limit")
    if sum(info.file_size for info in members) > MAX_ARCHIVE_BYTES:
        raise ValueError("Artifact archive exceeds uncompressed byte limit")
    return members


def _artifact_file_parts(archive: zipfile.ZipFile) -> List[Tuple[str, ...]]:
    """Allow only flat dbt/Recce JSON files or one target/ wrapper, never metadata paths."""
    files = []
    layouts = set()
    for info in _bounded_archive_members(archive):
        name = info.orig_filename
        parts = _archive_path_parts(name)
        is_dir = _archive_entry_is_dir(info, name)
        if any(part.startswith(".") or part.casefold() == "git~1" for part in parts):
            raise ValueError(f"Disallowed path in artifact archive: {name!r}")
        if is_dir:
            if parts != ("target",) or info.file_size:
                raise ValueError(f"Disallowed directory in artifact archive: {name!r}")
            layouts.add("target")
        else:
            if parts[-1] not in _ALLOWED_ARTIFACT_FILENAMES or not (
                len(parts) == 1 or (len(parts) == 2 and parts[0] == "target")
            ):
                raise ValueError(f"Disallowed filename or layout in artifact archive: {name!r}")
            layouts.add("target" if len(parts) == 2 else "flat")
            files.append(parts)
    if not files or len(layouts) != 1:
        raise ValueError("Artifact archive must contain JSON files in one flat or target/ layout")
    return files


def _archive_path_parts(name: str) -> Tuple[str, ...]:
    """
    Split an archive member name into path components, rejecting names that are not plain relative paths.

    Names are rejected rather than normalized so that a dangerous name never turns into a valid one.
    Windows filesystem aliases (ADS colons, device names, trailing dots/spaces) are
    rejected on Windows; drive-qualified paths are rejected on every platform.
    """
    relative = name[:-1] if name.endswith("/") else name
    parts = tuple(relative.split("/"))
    if not relative or relative.startswith("/") or ntpath.splitdrive(relative)[0] or "\\" in name or "\0" in name:
        raise ValueError(f"Unsafe path in artifact archive: {name!r}")
    for part in parts:
        if part in ("", ".", "..") or (
            os.name == "nt"
            and (
                ":" in part
                or part.endswith((".", " "))
                or part.partition(".")[0].rstrip(" ").upper() in _WINDOWS_RESERVED_NAMES
            )
        ):
            raise ValueError(f"Unsafe path in artifact archive: {name!r}")
    return parts


def _archive_entry_is_dir(info: zipfile.ZipInfo, name: str) -> bool:
    """Return whether the member is a directory; only regular files and directories are accepted."""
    if info.flag_bits & 0x1:
        raise ValueError(f"Encrypted entry in artifact archive is not supported: {name!r}")
    is_dir = name.endswith("/")
    file_type = stat.S_IFMT(info.external_attr >> 16)
    # Archives that record no Unix file type (e.g. created on Windows) leave the type bits empty.
    if file_type not in (0, stat.S_IFDIR if is_dir else stat.S_IFREG):
        raise ValueError(f"Unsupported entry type in artifact archive (only files and directories): {name!r}")
    return is_dir


def _destination_key(parts: Tuple[str, ...]) -> Tuple[str, ...]:
    """Normalize a destination so names that alias on case-insensitive or Unicode-normalizing filesystems match."""
    return tuple(unicodedata.normalize("NFC", part).casefold() for part in parts)


def _is_within(root: str, path: str) -> bool:
    try:
        return os.path.commonpath([root, path]) == root
    except ValueError:  # e.g. different drives on Windows
        return False


def _check_destination(root: str, name: str, parts: Tuple[str, ...], is_dir: bool, create_dirs: bool = False) -> str:
    """
    Check every existing component of the destination for `name` and return the destination path.

    Each existing component, including the leaf, must not be a symbolic link and must resolve inside
    `root`. Directory components must be directories and an existing file leaf must be a regular file.
    With `create_dirs`, missing directory components are created one at a time after their parent is checked.
    """
    path = root
    for index, part in enumerate(parts):
        path = os.path.join(path, part)
        want_dir = is_dir or index < len(parts) - 1
        try:
            mode = os.lstat(path).st_mode
        except FileNotFoundError:
            if not (create_dirs and want_dir):
                break
            os.mkdir(path)
            mode = os.lstat(path).st_mode
        if stat.S_ISLNK(mode):
            raise ValueError(f"Refusing to extract {name!r}: destination {path!r} is a symbolic link")
        if not _is_within(root, os.path.realpath(path)):
            raise ValueError(f"Refusing to extract {name!r}: destination {path!r} resolves outside {root!r}")
        if want_dir and not stat.S_ISDIR(mode):
            raise ValueError(f"Refusing to extract {name!r}: destination {path!r} exists and is not a directory")
        if not want_dir and not stat.S_ISREG(mode):
            raise ValueError(f"Refusing to extract {name!r}: destination {path!r} exists and is not a regular file")
    return os.path.join(root, *parts)


def _extract_zip(archive: zipfile.ZipFile, root: str) -> None:
    """
    Extract `archive` into `root`, keeping its layout, without following links or leaving the root.

    The whole member list is validated, and every file is staged and CRC-checked inside `root`,
    before anything is published. Staged files are moved into place with os.replace, so an existing
    regular file is replaced (never written through, e.g. as a hard link). Existing directories are
    merged and unrelated files are kept. This guards against archive contents and links already in
    `root`; it does not defend against another process concurrently changing `root`.
    """
    root = os.path.realpath(root)
    entries = []
    kinds = {}  # destination key -> is_dir, for every member and its implied parent directories
    members = set()
    for info in _bounded_archive_members(archive):
        name = info.orig_filename
        parts = _archive_path_parts(name)
        is_dir = _archive_entry_is_dir(info, name)
        key = _destination_key(parts)
        if key in members:
            raise ValueError(f"Duplicate destination in artifact archive: {name!r}")
        members.add(key)
        for depth in range(1, len(key) + 1):
            component_is_dir = is_dir or depth < len(key)
            if kinds.setdefault(key[:depth], component_is_dir) != component_is_dir:
                raise ValueError(f"Conflicting file and directory paths in artifact archive: {name!r}")
        entries.append((info, name, parts, is_dir))

    for _, name, parts, is_dir in entries:
        _check_destination(root, name, parts, is_dir)

    with tempfile.TemporaryDirectory(prefix=".recce-artifact-", dir=root) as staging:
        if _destination_key((os.path.basename(staging),)) in kinds:
            raise ValueError(f"Artifact archive collides with the staging directory {staging!r}")
        # Staged names are member indexes, never archive-controlled names. Reading each member
        # to EOF makes zipfile verify its CRC-32 before anything is published.
        total_bytes = 0
        for index, (info, _, _, is_dir) in enumerate(entries):
            if not is_dir:
                with archive.open(info) as source, open(os.path.join(staging, str(index)), "xb") as target:
                    while chunk := source.read(min(64 * 1024, MAX_ARCHIVE_BYTES - total_bytes + 1)):
                        total_bytes += len(chunk)
                        if total_bytes > MAX_ARCHIVE_BYTES:
                            raise ValueError("Artifact archive exceeds uncompressed byte limit")
                        target.write(chunk)

        for _, name, parts, is_dir in entries:
            _check_destination(root, name, parts, is_dir)

        for index, (_, name, parts, is_dir) in enumerate(entries):
            destination = _check_destination(root, name, parts, is_dir, create_dirs=True)
            if not is_dir:
                os.replace(os.path.join(staging, str(index)), destination)


def download_artifact(
    github_token: str, artifact: Artifact, *, worktree_root: Optional[str] = None
) -> Tuple[str, List[str]]:
    """Validate an artifact privately, then publish flat files in a fresh isolated directory.

    Return the absolute output directory and filenames. Existing worktree files are never
    extraction destinations. A failed validation or publication leaves no partial output.
    """
    root = os.path.realpath(worktree_root if worktree_root is not None else os.getcwd())
    if not os.path.isdir(root):
        raise ValueError("Artifact output anchor must be an existing worktree directory")
    headers = {
        "Authorization": f"Bearer {github_token}",
    }
    with tempfile.TemporaryDirectory(prefix="recce-artifact-validated-") as validated:
        with tempfile.TemporaryFile() as downloaded:
            with requests.get(
                artifact.archive_download_url, headers=headers, stream=True, timeout=ARTIFACT_DOWNLOAD_TIMEOUT
            ) as response:
                response.raise_for_status()
                received = 0
                for chunk in response.iter_content(chunk_size=64 * 1024):
                    received += len(chunk)
                    if received > MAX_DOWNLOAD_BYTES:
                        raise ValueError("Artifact download exceeds compressed byte limit")
                    downloaded.write(chunk)
            downloaded.seek(0)
            with zipfile.ZipFile(downloaded) as archive:
                files = _artifact_file_parts(archive)
                _extract_zip(archive, validated)
        # Publish one complete directory on the worktree filesystem, after CRC and policy checks.
        output = os.path.join(root, f".recce-github-artifact-{uuid.uuid4().hex}")
        if os.path.lexists(output):
            raise FileExistsError("Artifact output directory already exists")
        with tempfile.TemporaryDirectory(prefix=".recce-github-staging-", dir=root) as staging:
            for parts in files:
                shutil.copyfile(os.path.join(validated, *parts), os.path.join(staging, parts[-1]))
            os.rename(staging, output)
    return output, [parts[-1] for parts in files]


def recce_ci_artifact(**kwargs):
    """
    Download the artifact from the GitHub CI.
    """
    import git

    # Authentication is defined via github.Auth
    from github import Auth, Github
    from rich.console import Console
    from rich.markup import escape

    console = Console()
    github_token = kwargs.get("github_token")
    github_repository = kwargs.get("github_repository")

    if github_token is None:
        console.print("[[red]Error[/red]] Missing GitHub token. Please provide a GitHub token.")
        return 1

    auth = Auth.Token(github_token)
    github_instance = Github(auth=auth)

    try:
        git_instance = git.Repo(search_parent_directories=True)
    except git.exc.InvalidGitRepositoryError:
        console.print("[[red]Error[/red]] Not a git repository. Please run this command in a git repository.")
        return 1

    if git_instance.working_tree_dir is None:
        console.print("[[red]Error[/red]] No Git worktree found. Please run this command in a Git worktree.")
        return 1

    try:
        current_branch = git_instance.active_branch.name
    except TypeError:
        console.print("[[red]Error[/red]] Not a named branch. Please run this command in a named branch.")
        return 1

    if github_repository is None:
        remote_url = git_instance.remote().url
        github_repository = remote_url.split(":")[-1].replace(".git", "")

    github_owner, github_repo_name = github_repository.split("/")
    github_repo = github_instance.get_repo(github_repository)
    if github_repo is None:
        console.print("[[yellow]Skip[/yellow]] No GitHub repository found.")
        return 0

    head_branch = github_repo.get_branch(current_branch)

    console.rule("GitHub Repository Information")
    console.print(f"Repository:     {github_repository}")
    console.print(f"Current Branch: {current_branch}")

    pull_requests = github_repo.get_pulls(head=f"{github_owner}:{current_branch}")
    if pull_requests.totalCount == 0:
        # No pull request found for the current branch
        console.print("[[red]Error[/red]] No pull request found for the current branch.")
        return 1

    pr = pull_requests[0]

    console.rule("GitHub Pull Request Information")
    console.print(f"{pr.title} - {pr.html_url}")
    console.print(f"State: {pr.state.title()}")
    console.print(f"Author: {pr.user.name}")
    console.print(f"Created At: {pr.created_at}")

    workflow_runs = github_repo.get_workflow_runs(
        event="pull_request",
        status="success",
        branch=head_branch,
    )
    if workflow_runs.totalCount == 0:
        console.print("[[yellow]Skip[/yellow]] No successful workflow runs found.")
        return 0
    last_workflow_run = workflow_runs[0]
    console.rule("GitHub Workflow Run Information")
    console.print(f"Last Workflow Run: {last_workflow_run.name} {last_workflow_run.html_url}")
    artifacts = last_workflow_run.get_artifacts()
    if artifacts.totalCount == 0:
        console.print("[[yellow]Skip[/yellow]] No artifacts found.")
        return 0
    for artifact in artifacts:
        console.print(f"Artifact: {escape(artifact.name)}")
        try:
            output, artifact_files = download_artifact(
                github_token, artifact, worktree_root=git_instance.working_tree_dir
            )
        except requests.RequestException:
            # Transport errors can contain signed redirect URLs; do not echo them.
            console.print(f"[[red]Error[/red]] HTTP download failed for artifact {escape(artifact.name)}")
            return 1
        except (ValueError, OSError, zipfile.BadZipFile) as e:
            console.print(
                f"[[red]Error[/red]] Failed to download or extract artifact {escape(artifact.name)}: {escape(str(e))}"
            )
            return 1
        console.print(f"Artifact directory: {output}", markup=False, highlight=False, soft_wrap=True)
        console.print(f'Extracted Files: {", ".join(artifact_files)}')
    console.rule("Complete")
    return 0


def recce_base_artifact(**kwargs):
    # TODO: Implement this function
    pass


def get_pull_request(branch, owner, repo_name, github_token=None) -> Tuple[Optional[type(PullRequest)], Optional[str]]:
    g = Github(auth=Auth.Token(github_token)) if github_token else Github()

    try:
        repo = g.get_repo(f"{owner}/{repo_name}")
        pulls = repo.get_pulls(state="open")

        for pr in pulls:
            if pr.head.ref == branch:
                return pr, None

    except UnknownObjectException:
        if github_token is not None:
            return (
                None,
                f"Repository {owner}/{repo_name} not found. If it is private repo, please add the 'repo' scope to the token.",
            )

    return None, None


def recce_pr_information(github_token=None) -> Tuple[Optional[type(PullRequest)], Optional[str]]:
    branch = current_branch()
    repo = hosting_repo()

    if not repo:
        return None, "This is not a git repository."
    if "/" not in repo:
        return None, "This is not a GitHub repository."

    owner, repo_name = repo.split("/")

    github_token = github_token if github_token else os.getenv("GITHUB_TOKEN")
    return get_pull_request(branch, owner, repo_name, github_token)


def is_github_codespace():
    return os.getenv("CODESPACES") == "true"


def get_github_codespace_name():
    return os.getenv("CODESPACE_NAME")


def get_github_codespace_info():
    if is_github_codespace() is False:
        return None

    codespace_name = os.environ.get("CODESPACE_NAME")
    github_token = os.environ.get("GITHUB_TOKEN")

    response = requests.get(
        f"https://api.github.com/user/codespaces/{codespace_name}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"token {github_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )

    if response.status_code != 200:
        return None
    codespace_info = response.json()

    return dict(
        name=codespace_info.get("name"),
        machine=codespace_info.get("machine"),
        prebuild=codespace_info.get("prebuild"),
        created_at=codespace_info.get("created_at"),
        updated_at=codespace_info.get("updated_at"),
        last_used_at=codespace_info.get("last_used_at"),
        state=codespace_info.get("state"),
        location=codespace_info.get("location"),
        idle_timeout_minutes=codespace_info.get("idle_timeout_minutes"),
    )


def get_github_codespace_available_at(codespace):
    if is_github_codespace() is False:
        return None

    def search_in_file(file_path, search_string):
        with open(file_path, "r", encoding="utf-8") as f:
            for _, line in enumerate(f, 1):
                if search_string in line:
                    return line
        return None

    def extract_datatime(log_line):
        pattern = r"\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}).*\]"
        match = re.search(pattern, log_line)
        if match:
            datetime_str = match.group(1)
            return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S.%f")
        return None

    github_codepsce_log_dir = "/tmp/codespaces_logs"
    try:
        log_file = os.listdir(github_codepsce_log_dir)[-1]  # Get the latest log file
        start_monitor_line = search_in_file(f"{github_codepsce_log_dir}/{log_file}", "Starting monitor")
        return extract_datatime(start_monitor_line)
    except Exception:
        # If there is any error, use the updated_at time from the codespace info
        return datetime.fromisoformat(codespace.get("updated_at"))
