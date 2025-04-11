import json
import logging
import os
from typing import Dict, IO

import requests

from recce.pull_request import PullRequestInfo

RECCE_CLOUD_API_HOST = os.environ.get('RECCE_CLOUD_API_HOST', 'https://cloud.datarecce.io')

logger = logging.getLogger('uvicorn')


class PresignedUrlMethod:
    UPLOAD = 'upload'
    DOWNLOAD = 'download'


class RecceCloudException(Exception):
    def __init__(self, message: str, reason: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code

        try:
            reason = json.loads(reason).get('detail', '')
        except json.JSONDecodeError:
            pass
        self.reason = reason


class RecceCloud:
    def __init__(self, token: str):
        self.token = token
        self.base_url = f'{RECCE_CLOUD_API_HOST}/api/v1'

    def _request(self, method, url, **kwargs):
        headers = {
            'Authorization': f'Bearer {self.token}'
        }
        return requests.request(method, url, headers=headers, **kwargs)

    def get_presigned_url(self,
                          method: PresignedUrlMethod,
                          repository: str,
                          artifact_name: str,
                          metadata: dict = None,
                          pr_id: int = None,
                          branch: str = None) -> str:
        response = self._fetch_presigned_url(method, repository, artifact_name, metadata, pr_id, branch)
        return response.get('presigned_url')

    def get_download_presigned_url_with_tags(self,
                                             repository: str,
                                             artifact_name: str,
                                             branch: str = None) -> (str, dict):
        response = self._fetch_presigned_url(PresignedUrlMethod.DOWNLOAD, repository, artifact_name, branch=branch)
        return response.get('presigned_url'), response.get('tags', {})

    def _fetch_presigned_url(self,
                             method: PresignedUrlMethod,
                             repository: str,
                             artifact_name: str,
                             metadata: dict = None,
                             pr_id: int = None,
                             branch: str = None) -> str:
        if pr_id is not None:
            api_url = f'{self.base_url}/{repository}/pulls/{pr_id}/artifacts/{method}?artifact_name={artifact_name}&enable_ssec=true'
        elif branch is not None:
            api_url = f'{self.base_url}/{repository}/commits/{branch}/artifacts/{method}?artifact_name={artifact_name}&enable_ssec=true'
        else:
            raise ValueError('Either pr_id or sha must be provided.')
        response = self._request('POST', api_url, json=metadata)
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to {method} artifact {preposition} Recce Cloud.'.format(
                    method=method,
                    preposition='from' if method == PresignedUrlMethod.DOWNLOAD else 'to'
                ),
                reason=response.text,
                status_code=response.status_code
            )
        return response.json()

    def get_artifact_metadata(self, pr_info: PullRequestInfo) -> dict:
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/metadata'
        response = self._request('GET', api_url)
        if response.status_code == 204:
            return None
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to get artifact metadata from Recce Cloud.',
                reason=response.text,
                status_code=response.status_code
            )
        return response.json()

    def purge_artifacts(self, pr_info: PullRequestInfo):
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/artifacts'
        response = self._request('DELETE', api_url)
        if response.status_code != 204:
            raise RecceCloudException(
                message='Failed to purge artifacts from Recce Cloud.',
                reason=response.text,
                status_code=response.status_code
            )

    def check_artifacts_exists(self, pr_info: PullRequestInfo) -> bool:
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/metadata'
        response = self._request('GET', api_url)
        if response.status_code == 200:
            return True
        elif response.status_code == 204:
            return False
        else:
            raise RecceCloudException(
                message='Failed to check if artifacts exist in Recce Cloud.',
                reason=response.text,
                status_code=response.status_code
            )

    def share_state(self, file_name: str, file_io: IO):
        api_url = f'{self.base_url}/recce-state/upload'
        files = {'file': (file_name, file_io, 'application/json')}
        response = self._request('POST', api_url, files=files)
        if response.status_code == 403:
            return {'status': 'error', 'message': response.json().get('detail')}
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to share Recce state.',
                reason=response.text,
                status_code=response.status_code
            )
        return response.json()

    def update_github_pull_request_check(self, pr_info: PullRequestInfo, metadata: dict = None):
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/github/checks'
        try:
            self._request('POST', api_url, json=metadata)
        except Exception as e:
            # We don't care the response of this request, so we don't need to raise any exception.
            logger.debug(f'Failed to update the GitHub PR check. Reason: {str(e)}')

    def get_user_info(self) -> Dict:
        api_url = f'{self.base_url}/users'
        response = self._request('GET', api_url)
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to get user info from Recce Cloud.',
                reason=response.text,
                status_code=response.status_code
            )
        return response.json().get('user')

    def set_onboarding_state(self, state: str):
        api_url = f'{self.base_url}/users/onboarding-state'
        response = self._request('PUT', api_url, json={'state': state})
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to update onboarding state in Recce Cloud.',
                reason=response.text,
                status_code=response.status_code
            )


def get_recce_cloud_onboarding_state(token: str) -> str:
    try:
        recce_cloud = RecceCloud(token)
        user_info = recce_cloud.get_user_info()
        if user_info:
            return user_info.get('onboarding_state')
    except Exception as e:
        logger.debug(str(e))
    return 'undefined'


def set_recce_cloud_onboarding_state(token: str, new_state: str):
    recce_cloud = RecceCloud(token)
    recce_cloud.set_onboarding_state(new_state)
