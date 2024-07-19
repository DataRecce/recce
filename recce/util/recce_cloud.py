import json
import logging
import os

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

    def _request(self, method, url, data=None):
        headers = {
            'Authorization': f'Bearer {self.token}'
        }
        return requests.request(method, url, headers=headers, json=data)

    def get_presigned_url(self,
                          method: PresignedUrlMethod,
                          pr_info: PullRequestInfo,
                          artifact_name: str,
                          metadata: dict = None) -> str:
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/artifacts/{method}?artifact_name={artifact_name}&enable_ssec=true'
        response = self._request('POST', api_url, data=metadata)
        if response.status_code != 200:
            raise RecceCloudException(
                message='Failed to {method} artifact {preposition} Recce Cloud.'.format(
                    method=method,
                    preposition='from' if method == PresignedUrlMethod.DOWNLOAD else 'to'
                ),
                reason=response.text,
                status_code=response.status_code
            )
        presigned_url = response.json().get('presigned_url')
        return presigned_url

    def get_artifact_metadata(self, pr_info: PullRequestInfo, artifact_name: str) -> dict:
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/artifacts/{artifact_name}/metadata'
        response = self._request('GET', api_url)
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

    def update_github_pull_request_check(self, pr_info: PullRequestInfo, metadata: dict = None):
        api_url = f'{self.base_url}/{pr_info.repository}/pulls/{pr_info.id}/github/checks'
        try:
            self._request('POST', api_url, data=metadata)
        except Exception as e:
            # We don't care the response of this request, so we don't need to raise any exception.
            logger.debug(f'Failed to update the GitHub PR check. Reason: {str(e)}')
