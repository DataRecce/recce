import io
import os
import zipfile
from typing import List

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


def get_pull_request(branch, owner, repo_name, github_token=None):
    g = Github(auth=Auth.Token(github_token)) if github_token else Github()

    try:
        repo = g.get_repo(f"{owner}/{repo_name}")
        pulls = repo.get_pulls(state='open')

        for pr in pulls:
            if pr.head.ref == branch:
                return pr

    except UnknownObjectException:
        if github_token is None:
            print(f"Repository {owner}/{repo_name} not found. Please provide '$GITHUB_TOKEN' environment variable.")
        else:
            print(
                f"Repository {owner}/{repo_name} not found. If it is private repo, please add the 'repo' scope to the token.")
        return None

    return None


def recce_pr_information(github_token=None) -> PullRequest:
    branch = current_branch()
    repo = hosting_repo()

    if not repo:
        print('This is not a git repository.')
        return
    if '/' not in repo:
        print('This is not a GitHub repository.')
        return

    owner, repo_name = repo.split('/')

    github_token = github_token if github_token else os.getenv("GITHUB_TOKEN")
    pr = get_pull_request(branch, owner, repo_name, github_token)

    return pr if pr else None
