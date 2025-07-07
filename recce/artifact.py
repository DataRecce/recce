import gzip
import json
import os
import shutil
import tarfile
import tempfile
from urllib.parse import urlencode

import requests
from rich.console import Console

from recce.git import commit_hash_from_branch, current_branch, hosting_repo
from recce.state import s3_sse_c_headers
from recce.util.recce_cloud import PresignedUrlMethod, RecceCloud


def verify_artifacts_path(target_path: str) -> bool:
    """
    Verify if the target path is a valid artifacts path.

    :param target_path: the target path to check
    :return: True if the target path is a valid artifacts path, False otherwise
    """
    if not target_path:
        return False

    if not os.path.exists(target_path):
        return False

    if not os.path.isdir(target_path):
        return False

    required_artifacts_files = ["manifest.json", "catalog.json"]

    if all(f in os.listdir(target_path) for f in required_artifacts_files):
        # Check if the required files are present in the target path
        return True

    return False


def parse_dbt_version(file_path: str) -> str:
    with open(file_path, "r") as f:
        data = json.load(f)

    dbt_version = data.get("metadata", {}).get("dbt_version", None)
    return dbt_version


def archive_artifacts(target_path: str) -> (str, str):
    if verify_artifacts_path(target_path) is False:
        raise Exception(f"Invalid target path: {target_path}")

    manifest_path = os.path.join(target_path, "manifest.json")
    catalog_path = os.path.join(target_path, "catalog.json")

    dbt_version = parse_dbt_version(manifest_path)
    if dbt_version is None:
        raise Exception("Failed to parse dbt version from manifest.json")

    # prepare the temporary artifacts path
    tmp_dir = tempfile.mkdtemp()
    artifacts_tar_path = os.path.join(tmp_dir, "dbt_artifacts.tar")
    artifacts_tar_gz_path = artifacts_tar_path + ".gz"

    with tarfile.open(artifacts_tar_path, "w") as tar:
        tar.add(manifest_path, arcname="manifest.json")
        tar.add(catalog_path, arcname="catalog.json")

    # Compress the tar file
    with open(artifacts_tar_path, "rb") as f_in, gzip.open(artifacts_tar_gz_path, "wb") as f_out:
        f_out.writelines(f_in)

    # Clean up the temporary directory
    try:
        os.remove(artifacts_tar_path)
    except FileNotFoundError:
        pass

    return artifacts_tar_gz_path, dbt_version


def upload_dbt_artifacts(target_path: str, branch: str, token: str, password: str, debug: bool = False):
    console = Console()
    if verify_artifacts_path(target_path) is False:
        console.print(f"[[red]Error[/red]] Invalid target path: {target_path}")
        console.print("Please provide a valid target path containing manifest.json and catalog.json.")
        return 1

    if branch != current_branch():
        console.print(
            f"[[yellow]Warning[/yellow]] You are uploading the dbt artifacts as branch '{branch}'. "
            f"However, the current branch is '{current_branch()}'."
        )
        console.print("Please make sure you are uploading the dbt artifacts to the correct branch.")

    compress_file_path, dbt_version = archive_artifacts(target_path)
    repo = hosting_repo()
    sha = commit_hash_from_branch(branch)
    metadata = {"commit": sha, "dbt_version": dbt_version}

    # Get the presigned URL for uploading the artifacts
    presigned_url = RecceCloud(token).get_presigned_url_by_github_repo(
        method=PresignedUrlMethod.UPLOAD,
        repository=repo,
        artifact_name="dbt_artifacts.tar.gz",
        branch=branch,
        metadata=metadata,
    )

    if debug:
        console.rule("Debug information", style="blue")
        console.print(f"Branch: {branch}")
        console.print(f"Commit hash: {sha}")
        console.print(f"GitHub repository: {repo}")
        console.print(f"Artifact path: {compress_file_path}")
        console.print(f"DBT version: {dbt_version}")
        console.print(f"Presigned URL: {presigned_url}")
    console.print(f'Uploading the dbt artifacts from path "{target_path}" to branch "{branch}"')

    # Upload the compressed artifacts

    headers = s3_sse_c_headers(password)
    if metadata:
        headers["x-amz-tagging"] = urlencode(metadata)
    response = requests.put(presigned_url, data=open(compress_file_path, "rb").read(), headers=headers)
    if response.status_code != 200:
        raise Exception({response.text})

    # Clean up the compressed artifacts
    try:
        # Remove the compressed artifacts
        os.remove(compress_file_path)
        # Clean up the temporary directory
        os.rmdir(os.path.dirname(compress_file_path))
    except FileNotFoundError:
        pass


def download_dbt_artifacts(
    target_path: str, branch: str, token: str, password: str, force: bool = False, debug: bool = False
):
    console = Console()
    repo = hosting_repo()
    sha = None
    dbt_version = None

    presigned_url, tags = RecceCloud(token).get_download_presigned_url_by_github_repo_with_tags(
        repository=repo,
        artifact_name="dbt_artifacts.tar.gz",
        branch=branch,
    )
    if tags:
        sha = tags.get("commit")
        dbt_version = tags.get("dbt_version")

    if debug:
        console.rule("Debug information", style="blue")
        console.print(f"Git Branch: {branch}")
        console.print(f"Git Commit: {sha}")
        console.print(f"GitHub repository: {repo}")
        console.print(f"DBT version: {dbt_version}")
    console.print(f'Downloading from branch: "{branch}" and extracting to "{target_path}"')

    headers = s3_sse_c_headers(password)
    response = requests.get(presigned_url, headers=headers)

    if response.status_code != 200:
        raise Exception(response.text)

    if os.path.exists(target_path):
        if not force:
            raise Exception(
                f"Path {target_path} already exists. Please provide a new path or use '--force' option to overwrite the existing folder."
            )
        console.print(f"[[yellow]Warning[/yellow]] Overwrite existing path: {target_path}")
        shutil.rmtree(target_path)
    os.mkdir(target_path)

    tar_gz_file = os.path.join(target_path, "dbt_artifacts.tar.gz")
    with open(tar_gz_file, "wb") as f:
        f.write(response.content)

    with tarfile.open(tar_gz_file, "r") as tar:
        tar.extractall(path=target_path)

    # Clean up the compressed artifacts
    try:
        # Remove the compressed artifacts
        os.remove(tar_gz_file)
    except FileNotFoundError:
        pass
    return 0
