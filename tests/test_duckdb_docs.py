"""DuckDB migration guidance must not link to an absent release-notes file."""

import re
from pathlib import Path
from urllib.parse import urlsplit


def test_duckdb_migration_links_resolve():
    document = Path(__file__).resolve().parents[1] / "docs/architecture.md"
    paragraphs = [p for p in document.read_text().split("\n\n") if "duckdb" in p.lower()]
    for paragraph in paragraphs:
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", paragraph):
            url = urlsplit(target)
            if url.path and not url.scheme and not url.netloc:
                assert (document.parent / url.path).is_file(), f"Missing link target {target}"
