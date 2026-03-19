"""Custom hatch hooks for recce-cloud package."""

import os
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface
from hatchling.metadata.plugin.interface import MetadataHookInterface


class CustomMetadataHook(MetadataHookInterface):
    """Read README from package root directory for recce-cloud package."""

    PLUGIN_NAME = "custom"

    def update(self, metadata: dict) -> None:
        """Update metadata with README content from parent directory."""
        readme_path = Path(self.root) / "README.md"
        if readme_path.exists():
            metadata["readme"] = {
                "content-type": "text/markdown",
                "text": readme_path.read_text(encoding="utf-8"),
            }


class CustomBuildHook(BuildHookInterface):
    """Inject PostHog API keys at build time from environment variables.

    PostHog project API keys (phc_) are write-only public tokens safe for
    client-side use. They are injected at build time so the published package
    has telemetry enabled out of the box, while the source repo stays clean.

    Set these env vars before building:
      RECCE_POSTHOG_API_KEY          - production project key
      RECCE_POSTHOG_API_KEY_STAGING  - staging project key
    """

    PLUGIN_NAME = "custom"

    def initialize(self, version, build_data):
        """Generate _posthog_keys.py with API keys from env vars."""
        keys_path = Path(self.root) / "recce_cloud" / "_posthog_keys.py"
        prod_key = os.environ.get("RECCE_POSTHOG_API_KEY", "")
        staging_key = os.environ.get("RECCE_POSTHOG_API_KEY_STAGING", "")

        keys_path.write_text(
            '"""PostHog API keys — generated at build time by hatch_build.py."""\n'
            f'POSTHOG_KEY_PROD = "{prod_key}"\n'
            f'POSTHOG_KEY_STAGING = "{staging_key}"\n',
            encoding="utf-8",
        )
