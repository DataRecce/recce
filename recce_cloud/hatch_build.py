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
    """Inject PostHog production API key at build time from environment variable.

    PostHog project API keys (phc_) are write-only public tokens safe for
    client-side use. The production key is injected at build time so the
    published package has telemetry enabled out of the box, while the source
    repo stays clean.

    Set this env var before building:
      RECCE_POSTHOG_API_KEY  - production project key

    Staging key is NOT embedded — use the RECCE_POSTHOG_API_KEY_STAGING
    env var at runtime for local/staging testing.
    """

    PLUGIN_NAME = "custom"

    def initialize(self, version, build_data):
        """Generate _posthog_keys.py with the production API key from env var."""
        keys_path = Path(self.root) / "recce_cloud" / "_posthog_keys.py"
        prod_key = os.environ.get("RECCE_POSTHOG_API_KEY", "")

        keys_path.write_text(
            '"""PostHog API key — generated at build time by hatch_build.py."""\n'
            f'POSTHOG_KEY_PROD = "{prod_key}"\n',
            encoding="utf-8",
        )
