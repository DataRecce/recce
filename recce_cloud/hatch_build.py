"""Custom hatch build hook to read README from package root directory."""

from pathlib import Path

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
