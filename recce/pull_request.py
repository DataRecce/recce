import json
import os
from typing import Optional

import requests

from recce.git import hosting_repo
from recce.github import recce_pr_information
from recce.state import PullRequestInfo


def fetch_pr_metadata(**kwargs):
    pr_info = PullRequestInfo()

    # fetch from github action event path
    metadata = fetch_pr_metadata_from_event_path()
    if metadata is not None:
        pr_info.id = metadata.get('github_pr_id')
        pr_info.url = metadata.get('github_pr_url')
        pr_info.title = metadata.get('github_pr_title')
    else:
        repo = hosting_repo()
        pr = recce_pr_information(**kwargs)
        if pr:
            pr_info.repository = repo
            pr_info.id = pr.number
            pr_info.title = pr.title
            pr_info.url = pr.html_url
            pr_info.base_branch = pr.base.ref
            pr_info.branch = pr.head.ref

    # fetch from cli arguments
    if pr_info.url is None and 'github_pull_request_url' in kwargs:
        pr_info.url = kwargs.get('github_pull_request_url')

    if pr_info.branch is None:
        pr_info.branch = kwargs.get('git_current_branch')

    if pr_info.base_branch is None:
        pr_info.base_branch = kwargs.get('git_base_branch')

    # fetch from env
    if pr_info.url is None:
        pr_info.url = os.getenv("RECCE_PR_URL")

    return pr_info


def fetch_pr_metadata_from_event_path() -> Optional[dict]:
    """
        If recce run is running in a GitHub Action, this function will return the pull request metadata.

        Example:
        {
            "github_pr_id": 1,
            "github_pr_url": "https://github.com/xyz/abc/pull/1
            "github_pr_title": "Update README.md"
        }

        :return: dict
    """

    # get the event json from the path in GITHUB_EVENT_PATH
    event_path = os.getenv("GITHUB_EVENT_PATH")
    if event_path:
        try:
            with open(event_path, "r") as event_file:
                event_data = json.load(event_file)

            pr_id = event_data["number"]
            if event_data.get("pull_request"):
                pull_request_data = event_data["pull_request"]
                pr_url = pull_request_data["_links"]["html"]["href"]
                pr_api = pull_request_data["_links"]["self"]["href"]
                pr_title = _fetch_pr_title(pr_api)
                return dict(github_pr_id=pr_id, github_pr_url=pr_url, github_pr_title=pr_title)
            else:
                print("Not a pull request event, skip.")
        except Exception as e:
            print("Cannot parse github action event", e)
    return None


def _fetch_pr_title(endpoint) -> Optional[str]:
    github_token = os.getenv("GITHUB_TOKEN")

    if github_token is None:
        return None

    try:
        headers = {"Authorization": f"Bearer {github_token}"}
        response = requests.get(endpoint, headers=headers)

        if response.status_code == 200:
            pull_request_data = response.json()
            return pull_request_data.get('title')
    except Exception as e:
        print("Cannot fetch PR title: ", e)

    return None
