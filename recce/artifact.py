import gzip
import os
import shutil
import tarfile
import tempfile

import requests
from rich.console import Console

from recce.git import hosting_repo, current_commit_hash, commit_hash_from_branch
from recce.state import s3_sse_c_headers
from recce.util.recce_cloud import RecceCloud, PresignedUrlMethod


def verify_artifact_path(target_path: str) -> bool:
    """
    Verify if the target path is a valid artifact path.

    :param target_path: the target path to check
    :return: True if the target path is a valid artifact path, False otherwise
    """
    if not target_path:
        return False

    if not os.path.exists(target_path):
        return False

    if not os.path.isdir(target_path):
        return False

    required_artifact_files = [
        'manifest.json',
        'catalog.json'
    ]

    if all(f in os.listdir(target_path) for f in required_artifact_files):
        # Check if the required files are present in the target path
        return True

    return False


def archive_artifact(target_path: str) -> str:
    if verify_artifact_path(target_path) is False:
        return None

    # prepare the temporary artifact path
    tmp_dir = tempfile.mkdtemp()
    artifact_tar_path = os.path.join(tmp_dir, 'dbt_artifact.tar')
    artifact_tar_gz_path = artifact_tar_path + '.gz'

    with tarfile.open(artifact_tar_path, 'w') as tar:
        manifest_path = os.path.join(target_path, 'manifest.json')
        catalog_path = os.path.join(target_path, 'catalog.json')
        tar.add(manifest_path, arcname='manifest.json')
        tar.add(catalog_path, arcname='catalog.json')

    # Compress the tar file
    with open(artifact_tar_path, 'rb') as f_in, gzip.open(artifact_tar_gz_path, 'wb') as f_out:
        f_out.writelines(f_in)

    # Clean up the temporary directory
    try:
        os.remove(artifact_tar_path)
    except FileNotFoundError:
        pass

    return artifact_tar_gz_path


def upload_dbt_artifact(target_path: str, branch: str, token: str, password: str, debug: bool = False):
    console = Console()
    if verify_artifact_path(target_path) is False:
        console.print(f"[[red]Error[/red]] Invalid target path: {target_path}")
        console.print("Please provide a valid target path containing manifest.json and catalog.json.")
        return 1

    compress_file_path = archive_artifact(target_path)
    repo = hosting_repo()

    # Get the presigned URL for uploading the artifact
    presigned_url = RecceCloud(token).get_presigned_url(
        method=PresignedUrlMethod.UPLOAD,
        repository=repo,
        artifact_name='dbt_artifact.tar.gz',
        sha=current_commit_hash(),
    )

    if debug:
        console.print('Git information:')
        console.print(f'Branch: {branch}')
        console.print(f'Commit hash: {current_commit_hash()}')
        console.print(f'GitHub repository: {repo}')
        console.print(f'Artifact path: {compress_file_path}')
        console.print(f'Presigned URL: {presigned_url}')

    # Upload the compressed artifact
    headers = s3_sse_c_headers(password)
    response = requests.put(presigned_url, data=open(compress_file_path, 'rb').read(), headers=headers)
    if response.status_code != 200:
        raise Exception({response.text})

    # Clean up the compressed artifact
    try:
        # Remove the compressed artifact
        os.remove(compress_file_path)
        # Clean up the temporary directory
        os.rmdir(os.path.dirname(compress_file_path))
    except FileNotFoundError:
        pass


def download_dbt_artifact(target_path: str, branch: str, token: str, password: str,
                          force: bool = False,
                          debug: bool = False):
    repo = hosting_repo()
    sha = commit_hash_from_branch(branch)
    if debug:
        console = Console()
        console.rule('Debug information:')
        console.print(f'Git Branch: {branch}')
        console.print(f'Git Commit hash: {sha}')
        console.print(f'GitHub repository: {repo}')

    if os.path.exists(target_path):
        if not force:
            raise Exception(f'Path {target_path} already exists. Please provide a new path.')
        console.print(f'[[yellow]Warning[/yellow]] Removing existing path: {target_path}')
        shutil.rmtree(target_path)

    os.mkdir(target_path)

    presigned_url = RecceCloud(token).get_presigned_url(
        method=PresignedUrlMethod.DOWNLOAD,
        repository=repo,
        artifact_name='dbt_artifact.tar.gz',
        sha=sha,
    )
    headers = s3_sse_c_headers(password)
    response = requests.get(presigned_url, headers=headers)

    if response.status_code != 200:
        raise Exception(response.text)

    tar_gz_file = os.path.join(target_path, 'dbt_artifact.tar.gz')
    with open(tar_gz_file, 'wb') as f:
        f.write(response.content)

    with tarfile.open(tar_gz_file, 'r') as tar:
        tar.extractall(path=target_path)

    # Clean up the compressed artifact
    try:
        # Remove the compressed artifact
        os.remove(tar_gz_file)
    except FileNotFoundError:
        pass
    return 0
