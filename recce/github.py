import io
import os
import re
import zipfile
from datetime import datetime
from typing import List, Tuple, Optional

import requests
from github import Artifact, Github, Auth, UnknownObjectException, PullRequest

from recce.git import current_branch, hosting_repo


def download_artifact(github_token: str, artifact: Artifact) -> List[str]:
    """
    Download the artifact from the Github.
    """
    headers = {
        'Authorization': f'Bearer {github_token}',
    }
    r = requests.get(artifact.archive_download_url, headers=headers)
    r.raise_for_status()
    z = zipfile.ZipFile(io.BytesIO(r.content))
    z.extractall()
    return z.namelist()


def recce_ci_artifact(**kwargs):
    """
        Download the artifact from the GitHub CI.
    """
    from rich.console import Console

    import git
    # Authentication is defined via github.Auth
    from github import Auth, Github

    console = Console()
    github_token = kwargs.get('github_token')
    github_repository = kwargs.get('github_repository')

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

    console.rule('GitHub Repository Information')
    console.print(f'Repository:     {github_repository}')
    console.print(f'Current Branch: {current_branch}')

    pull_requests = github_repo.get_pulls(head=f'{github_owner}:{current_branch}')
    if pull_requests.totalCount == 0:
        # No pull request found for the current branch
        console.print("[[red]Error[/red]] No pull request found for the current branch.")
        return 1

    pr = pull_requests[0]

    console.rule('GitHub Pull Request Information')
    console.print(f'{pr.title} - {pr.html_url}')
    console.print(f'State: {pr.state.title()}')
    console.print(f'Author: {pr.user.name}')
    console.print(f'Created At: {pr.created_at}')

    workflow_runs = github_repo.get_workflow_runs(
        event='pull_request',
        status='success',
        branch=head_branch,
    )
    if workflow_runs.totalCount == 0:
        console.print("[[yellow]Skip[/yellow]] No successful workflow runs found.")
        return 0
    last_workflow_run = workflow_runs[0]
    console.rule('GitHub Workflow Run Information')
    console.print(f'Last Workflow Run: {last_workflow_run.name} {last_workflow_run.html_url}')
    artifacts = last_workflow_run.get_artifacts()
    if artifacts.totalCount == 0:
        console.print("[[yellow]Skip[/yellow]] No artifacts found.")
        return 0
    for artifact in artifacts:
        console.print(f'Artifact: {artifact.name} {artifact.archive_download_url}')
        artifact_files = download_artifact(github_token, artifact)
        console.print(f'Extracted Files: {", ".join(artifact_files)}')
    console.rule('Complete')
    return 0


def recce_base_artifact(**kwargs):
    # TODO: Implement this function
    pass


def get_pull_request(branch, owner, repo_name, github_token=None) -> Tuple[Optional[type(PullRequest)], Optional[str]]:
    g = Github(auth=Auth.Token(github_token)) if github_token else Github()

    try:
        repo = g.get_repo(f"{owner}/{repo_name}")
        pulls = repo.get_pulls(state='open')

        for pr in pulls:
            if pr.head.ref == branch:
                return pr, None

    except UnknownObjectException:
        if github_token is not None:
            return None, f"Repository {owner}/{repo_name} not found. If it is private repo, please add the 'repo' scope to the token."

    return None, None


def recce_pr_information(github_token=None) -> Tuple[Optional[type(PullRequest)], Optional[str]]:
    branch = current_branch()
    repo = hosting_repo()

    if not repo:
        return None, 'This is not a git repository.'
    if '/' not in repo:
        return None, 'This is not a GitHub repository.'

    owner, repo_name = repo.split('/')

    github_token = github_token if github_token else os.getenv("GITHUB_TOKEN")
    return get_pull_request(branch, owner, repo_name, github_token)


def is_github_codespace():
    return os.getenv('CODESPACES') == 'true'


def get_github_codespace_name():
    return os.getenv('CODESPACE_NAME')


def get_github_codespace_info():
    if is_github_codespace() is False:
        return None

    codespace_name = os.environ.get('CODESPACE_NAME')
    github_token = os.environ.get('GITHUB_TOKEN')

    response = requests.get(
        f'https://api.github.com/user/codespaces/{codespace_name}',
        headers={
            'Accept': 'application/vnd.github+json',
            'Authorization': f'token {github_token}',
            'X-GitHub-Api-Version': '2022-11-28',
        })

    if response.status_code != 200:
        return None
    codespace_info = response.json()

    return dict(
        name=codespace_info.get('name'),
        machine=codespace_info.get('machine'),
        prebuild=codespace_info.get('prebuild'),
        created_at=codespace_info.get('created_at'),
        updated_at=codespace_info.get('updated_at'),
        last_used_at=codespace_info.get('last_used_at'),
        state=codespace_info.get('state'),
        location=codespace_info.get('location'),
        idle_timeout_minutes=codespace_info.get('idle_timeout_minutes'),
    )


def get_github_codespace_available_at(codespace):
    if is_github_codespace() is False:
        return None

    def search_in_file(file_path, search_string):
        with open(file_path, 'r') as f:
            for _, line in enumerate(f, 1):
                if search_string in line:
                    return line
        return None

    def extract_datatime(log_line):
        pattern = r'\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}).*\]'
        match = re.search(pattern, log_line)
        if match:
            datetime_str = match.group(1)
            return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S.%f')
        return None

    github_codepsce_log_dir = '/tmp/codespaces_logs'
    try:
        log_file = os.listdir(github_codepsce_log_dir)[-1]  # Get the latest log file
        start_monitor_line = search_in_file(f'{github_codepsce_log_dir}/{log_file}', 'Starting monitor')
        return extract_datatime(start_monitor_line)
    except Exception:
        # If there is any error, use the updated_at time from the codespace info
        return datetime.fromisoformat(codespace.get('updated_at'))
