import os
from pathlib import Path
from typing import List, Optional

import click

from recce.constants import RECCE_CONFIG_FILE, RECCE_ERROR_LOG_FILE
from recce.util.startup_perf import track_timing

from .track import TrackCommand


def create_state_loader(review_mode, cloud_mode, state_file, cloud_options):
    from rich.console import Console

    from recce.state import CloudStateLoader, FileStateLoader
    from recce.util.recce_cloud import RecceCloudException

    console = Console()

    try:
        state_loader = (
            CloudStateLoader(review_mode=review_mode, cloud_options=cloud_options)
            if cloud_mode
            else FileStateLoader(review_mode=review_mode, state_file=state_file)
        )
        return state_loader
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to create recce state loader")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to create recce state loader")
        console.print(f"Reason: {e}")
        exit(1)


def patch_derived_args(args):
    """
    Patch derived args based on other args.
    """
    if args.get("session_id") or args.get("share_url"):
        args["cloud"] = True
        args["review"] = True


@track_timing("state_loader_init")
def create_state_loader_by_args(state_file=None, **kwargs):
    """
    Create a state loader based on CLI arguments.

    This function handles the cloud options logic that is shared between
    server and mcp-server commands.

    Args:
        state_file: Optional path to state file
        **kwargs: CLI arguments including api_token, cloud, review, session_id, share_url, etc.

    Returns:
        state_loader: The created state loader instance
    """
    from rich.console import Console

    console = Console(stderr=True)

    api_token = kwargs.get("api_token")
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    cloud_options = None

    # Handle share_url and session_id
    share_url = kwargs.get("share_url")
    session_id = kwargs.get("session_id")

    if share_url:
        share_id = share_url.split("/")[-1]
        if not share_id:
            console.print("[[red]Error[/red]] Invalid share URL format.")
            exit(1)

    if is_cloud:
        # Cloud mode
        if share_url:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "api_token": api_token,
                "share_id": share_id,
            }
        elif session_id:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "api_token": api_token,
                "session_id": session_id,
            }
        else:
            cloud_options = {
                "host": kwargs.get("state_file_host"),
                "github_token": kwargs.get("cloud_token"),
                "password": kwargs.get("password"),
            }

    # Create state loader
    state_loader = create_state_loader(is_review, is_cloud, state_file, cloud_options)

    return state_loader


def handle_debug_flag(**kwargs):
    if kwargs.get("debug"):
        import logging

        from recce.util.logger import CustomFormatter

        ch = logging.StreamHandler()
        ch.setFormatter(CustomFormatter())
        logging.basicConfig(handlers=[ch], level=logging.DEBUG)

        # Explicitly set uvicorn logger to DEBUG level
        uvicorn_logger = logging.getLogger("uvicorn")
        uvicorn_logger.setLevel(logging.DEBUG)

        # Set all child loggers to DEBUG as well
        for handler in uvicorn_logger.handlers:
            handler.setLevel(logging.DEBUG)


def add_options(options):
    def _add_options(func):
        for option in reversed(options):
            func = option(func)
        return func

    return _add_options


dbt_related_options = [
    click.option("--target", "-t", help="Which target to load for the given profile.", type=click.STRING),
    click.option("--profile", help="Which existing profile to load.", type=click.STRING),
    click.option(
        "--project-dir",
        help="Which directory to look in for the dbt_project.yml file.",
        type=click.Path(),
        envvar="DBT_PROJECT_DIR",
    ),
    click.option(
        "--profiles-dir",
        help="Which directory to look in for the profiles.yml file.",
        type=click.Path(),
        envvar="DBT_PROFILES_DIR",
    ),
]

sqlmesh_related_options = [
    click.option("--sqlmesh", is_flag=True, help="Use SQLMesh ", hidden=True),
    click.option("--sqlmesh-envs", is_flag=False, help="SQLMesh envs to compare. SOURCE:TARGET", hidden=True),
    click.option("--sqlmesh-config", is_flag=False, help="SQLMesh config name to use", hidden=True),
]

recce_options = [
    click.option(
        "--config",
        help="Path to the recce config file.",
        type=click.Path(),
        default=RECCE_CONFIG_FILE,
        show_default=True,
    ),
    click.option(
        "--error-log", help="Path to the error log file.", type=click.Path(), default=RECCE_ERROR_LOG_FILE, hidden=True
    ),
    click.option("--debug", is_flag=True, help="Enable debug mode.", hidden=True),
]

recce_cloud_options = [
    click.option("--cloud", is_flag=True, help="Fetch the state file from cloud."),
    click.option(
        "--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN"
    ),
    click.option(
        "--state-file-host",
        help="The host to fetch the state file from.",
        type=click.STRING,
        envvar="RECCE_STATE_FILE_HOST",
        default="",
        hidden=True,
    ),
    click.option(
        "--password",
        "-p",
        help="The password to encrypt the state file in cloud.",
        type=click.STRING,
        envvar="RECCE_STATE_PASSWORD",
    ),
]

recce_cloud_auth_options = [
    click.option(
        "--api-token",
        help="The personal token generated by Recce Cloud.",
        type=click.STRING,
        envvar="RECCE_API_TOKEN",
    )
]

recce_dbt_artifact_dir_options = [
    click.option(
        "--target-path",
        help="dbt artifacts directory for your development branch.",
        type=click.STRING,
        default="target",
    ),
    click.option(
        "--target-base-path",
        help="dbt artifacts directory to be used as the base for the comparison.",
        type=click.STRING,
        default="target-base",
    ),
]

recce_hidden_options = [
    click.option(
        "--mode",
        envvar="RECCE_SERVER_MODE",
        type=click.Choice(["server", "preview", "read-only"], case_sensitive=False),
        hidden=True,
    ),
    click.option(
        "--share-url",
        help="The share URL triggers this instance.",
        type=click.STRING,
        envvar="RECCE_SHARE_URL",
        hidden=True,
    ),
    click.option(
        "--session-id",
        help="The session ID triggers this instance.",
        type=click.STRING,
        envvar=["RECCE_SESSION_ID", "RECCE_SNAPSHOT_ID"],  # Backward compatibility with RECCE_SNAPSHOT_ID
        hidden=True,
    ),
]


def _execute_sql(context, sql_template, base=False):
    try:
        import pandas as pd
    except ImportError:
        print("'pandas' package not found. You can install it using the command: 'pip install pandas'.")
        exit(1)

    from recce.adapter.dbt_adapter import DbtAdapter

    dbt_adapter: DbtAdapter = context.adapter
    with dbt_adapter.connection_named("recce"):
        sql = dbt_adapter.generate_sql(sql_template, base)
        response, result = dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        table = result
        df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
        return df


@click.group()
@click.pass_context
def cli(ctx, **kwargs):
    """Recce: Data validation toolkit for comprehensive PR review"""
    from rich.console import Console

    from recce import __is_recce_outdated__, __latest_version__

    if __is_recce_outdated__ is True:
        error_console = Console(stderr=True, style="bold")
        error_console.print(
            f"[[yellow]Update Available[/yellow]] A new version of Recce {__latest_version__} is available.",
        )
        error_console.print("Please update using the command: 'pip install --upgrade recce'.", end="\n\n")


@cli.command(cls=TrackCommand)
def version():
    """
    Show version information
    """
    from recce import __version__

    print(__version__)


@cli.command(cls=TrackCommand)
@add_options(dbt_related_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@click.option(
    "--cache-db",
    help="Path to the column-level lineage cache database.",
    type=click.Path(),
    default=None,
    show_default=False,
)
@click.option(
    "--session-id",
    help="Recce Cloud session ID (for --cloud mode).",
    type=click.STRING,
    envvar="RECCE_SESSION_ID",
)
def init(cache_db, **kwargs):
    """
    Pre-compute column-level lineage cache from dbt artifacts.

    Computes column-level lineage for all models and stores results in a SQLite database
    (~/.recce/cll_cache.db by default) so that subsequent `recce server`
    sessions start with a warm cache.

    With --cloud, downloads artifacts from Recce Cloud, computes CLL, and
    uploads the cache and CLL map back to the session's S3 bucket.

    Works with one or both environments (target/ and/or target-base/).
    """

    import json
    import logging
    import shutil
    import tempfile
    import time

    import requests
    from rich.console import Console
    from rich.progress import Progress

    from recce import __version__
    from recce.adapter.dbt_adapter import DbtAdapter
    from recce.core import load_context
    from recce.util.cll import _DEFAULT_DB_PATH, CllCache, get_cll_cache, set_cll_cache
    from recce.util.info_emitter import emit_info_and_lineage_diff
    from recce.util.per_node_db import SCHEMA_VERSION as PER_NODE_DB_SCHEMA_VERSION
    from recce.util.per_node_db import (
        PerNodeDbWriter,
        extract_rows_from_artifacts,
    )

    logger = logging.getLogger("recce")
    console = Console()
    console.rule("Recce Init — Building column-level lineage cache", style="orange3")

    # Timeouts for HTTP requests (seconds): short for metadata, long for large files
    _METADATA_TIMEOUT = 30
    _DOWNLOAD_TIMEOUT = 300
    _UPLOAD_TIMEOUT = 600

    is_cloud = kwargs.get("cloud", False)
    session_id = kwargs.get("session_id")
    cloud_client = None
    cloud_org_id = None
    cloud_project_id = None
    if is_cloud:
        from recce.util.recce_cloud import RecceCloud, RecceCloudException

        cloud_token = kwargs.get("cloud_token") or kwargs.get("api_token")
        if not cloud_token:
            console.print("[[red]Error[/red]] --cloud requires --cloud-token or --api-token (or GITHUB_TOKEN env var).")
            exit(1)
        if not session_id:
            console.print("[[red]Error[/red]] --cloud requires --session-id (or RECCE_SESSION_ID env var).")
            exit(1)

        cloud_client = RecceCloud(token=cloud_token)
        if kwargs.get("state_file_host"):
            host = kwargs["state_file_host"]
            cloud_client.base_url = f"{host}/api/v1"
            cloud_client.base_url_v2 = f"{host}/api/v2"

        console.print(f"[bold]Cloud mode[/bold]: session {session_id}")

        # Get session info
        try:
            session_info = cloud_client.get_session(session_id)
        except RecceCloudException as e:
            console.print(f"[[red]Error[/red]] Failed to get session: {e}")
            exit(1)
        if session_info.get("status") == "error":
            console.print(f"[[red]Error[/red]] Failed to get session: {session_info.get('message', 'Access denied')}")
            exit(1)
        cloud_org_id = session_info.get("org_id")
        cloud_project_id = session_info.get("project_id")
        if not cloud_org_id or not cloud_project_id:
            console.print(f"[[red]Error[/red]] Session {session_id} missing org_id or project_id.")
            exit(1)

        # Download artifacts to local target directories
        console.print("Downloading artifacts from Cloud...")
        try:
            download_urls = cloud_client.get_download_urls_by_session_id(cloud_org_id, cloud_project_id, session_id)
        except RecceCloudException as e:
            console.print(f"[[red]Error[/red]] Failed to get download URLs: {e}")
            exit(1)

        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_path = project_dir_path / kwargs.get("target_path", "target")
        target_base_path = project_dir_path / kwargs.get("target_base_path", "target-base")
        target_path.mkdir(parents=True, exist_ok=True)
        target_base_path.mkdir(parents=True, exist_ok=True)

        # Download current session artifacts
        for artifact_key, filename in [("manifest_url", "manifest.json"), ("catalog_url", "catalog.json")]:
            url = download_urls.get(artifact_key)
            if url:
                try:
                    resp = requests.get(url, timeout=_METADATA_TIMEOUT)
                    if resp.status_code == 200:
                        (target_path / filename).write_bytes(resp.content)
                        console.print(f"  Downloaded {filename} to {target_path}")
                    else:
                        console.print(
                            f"  [[yellow]Warning[/yellow]] Failed to download {filename}: HTTP {resp.status_code}"
                        )
                except requests.RequestException as e:
                    console.print(f"  [[yellow]Warning[/yellow]] Failed to download {filename}: {e}")

        # Download base session artifacts
        try:
            base_download_urls = cloud_client.get_base_session_download_urls(
                cloud_org_id, cloud_project_id, session_id=session_id
            )
        except RecceCloudException as e:
            console.print(f"  [[yellow]Warning[/yellow]] Failed to get base session URLs: {e}")
            base_download_urls = {}
        for artifact_key, filename in [("manifest_url", "manifest.json"), ("catalog_url", "catalog.json")]:
            url = base_download_urls.get(artifact_key)
            if url:
                try:
                    resp = requests.get(url, timeout=_METADATA_TIMEOUT)
                    if resp.status_code == 200:
                        (target_base_path / filename).write_bytes(resp.content)
                        console.print(f"  Downloaded base {filename} to {target_base_path}")
                    else:
                        console.print(
                            f"  [[yellow]Warning[/yellow]] Failed to download base {filename}: HTTP {resp.status_code}"
                        )
                except requests.RequestException as e:
                    console.print(f"  [[yellow]Warning[/yellow]] Failed to download base {filename}: {e}")

        # Download existing CLL cache for warm start.
        # Try current session first, then fall back to production (base) session.
        # Use streaming to avoid loading large cache files entirely into memory.
        if cache_db is None:
            cache_db = _DEFAULT_DB_PATH
        Path(cache_db).parent.mkdir(parents=True, exist_ok=True)

        def _stream_download_to_file(url: str, dest: Path) -> int:
            """Stream a URL to a file, returning bytes written. Raises on failure."""
            resp = requests.get(url, stream=True, timeout=_DOWNLOAD_TIMEOUT)
            if resp.status_code != 200:
                return 0
            total = 0
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False, suffix=".tmp") as tmp:
                tmp_path = Path(tmp.name)
                try:
                    for chunk in resp.iter_content(chunk_size=8192):
                        tmp.write(chunk)
                        total += len(chunk)
                    tmp.flush()
                except Exception:
                    tmp_path.unlink(missing_ok=True)
                    raise
            if total > 0:
                tmp_path.rename(dest)
            else:
                tmp_path.unlink(missing_ok=True)
            return total

        cache_downloaded = False
        cll_cache_url = download_urls.get("cll_cache_url")
        if cll_cache_url:
            try:
                nbytes = _stream_download_to_file(cll_cache_url, Path(cache_db))
                if nbytes > 0:
                    console.print(f"  Downloaded CLL cache from session ({nbytes / 1024 / 1024:.1f} MB)")
                    cache_downloaded = True
            except requests.RequestException as e:
                console.print(f"  [[yellow]Warning[/yellow]] Failed to download CLL cache: {e}")

        if not cache_downloaded:
            # Fall back to production (base) session cache
            base_cache_url = base_download_urls.get("cll_cache_url")
            if base_cache_url:
                try:
                    nbytes = _stream_download_to_file(base_cache_url, Path(cache_db))
                    if nbytes > 0:
                        console.print(f"  Downloaded CLL cache from base session ({nbytes / 1024 / 1024:.1f} MB)")
                        cache_downloaded = True
                except requests.RequestException as e:
                    console.print(f"  [[yellow]Warning[/yellow]] Failed to download base CLL cache: {e}")

        if not cache_downloaded:
            console.print("  [dim]No existing CLL cache found — will compute from scratch[/dim]")

    if cache_db is None:
        cache_db = _DEFAULT_DB_PATH

    # Set up cache with SQLite persistence
    set_cll_cache(CllCache(db_path=cache_db))

    cache = get_cll_cache()
    evicted = cache.evict_stale()
    if evicted:
        console.print(f"Evicted {evicted} stale cache entries (>7 days unused)")

    # Check which artifact directories exist
    if not is_cloud:
        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_path = project_dir_path / kwargs.get("target_path", "target")
        target_base_path = project_dir_path / kwargs.get("target_base_path", "target-base")

    has_target = (target_path / "manifest.json").is_file()
    has_base = (target_base_path / "manifest.json").is_file()

    if not has_target and not has_base:
        console.print(
            "[[yellow]Warning[/yellow]] No dbt artifacts found.\n"
            f"  Checked: {target_path}/manifest.json\n"
            f"  Checked: {target_base_path}/manifest.json\n\n"
            "Run [bold]dbt docs generate[/bold] or [bold]dbt compile[/bold] first."
        )
        return

    # If only one env exists, use it for both (so load_context doesn't fail)
    context_kwargs = {**kwargs}
    if has_target and not has_base:
        console.print("[dim]Only target/ found — building cache for current environment only.[/dim]")
        context_kwargs["target_base_path"] = kwargs.get("target_path", "target")
    elif has_base and not has_target:
        console.print("[dim]Only target-base/ found — building cache for base environment only.[/dim]")
        context_kwargs["target_path"] = kwargs.get("target_base_path", "target-base")

    try:
        ctx = load_context(**context_kwargs)
    except Exception as e:
        console.print(f"[[red]Error[/red]] Failed to load context: {e}")
        exit(1)

    dbt_adapter: DbtAdapter = ctx.adapter

    # Warn if catalog.json is missing — cache keys include column names from
    # the catalog, so entries built without it will mismatch at server time.
    catalog_missing = []
    if has_target and not (target_path / "catalog.json").is_file():
        catalog_missing.append(f"  {target_path}/catalog.json")
    if has_base and not (target_base_path / "catalog.json").is_file():
        catalog_missing.append(f"  {target_base_path}/catalog.json")
    if catalog_missing:
        console.print(
            "[[yellow]Warning[/yellow]] catalog.json not found:\n"
            + "\n".join(catalog_missing)
            + "\n\nWithout it, cache entries will not match when the server loads a catalog.\n"
            "Run [bold]dbt docs generate[/bold] before [bold]recce init[/bold] for best results."
        )

    envs = []
    if has_target and dbt_adapter.curr_manifest:
        curr_ids = [
            nid
            for nid in dbt_adapter.curr_manifest.nodes
            if dbt_adapter.curr_manifest.nodes[nid].resource_type in ("model", "snapshot")
        ]
        envs.append(("current", curr_ids, False))

    if has_base and dbt_adapter.base_manifest:
        base_ids = [
            nid
            for nid in dbt_adapter.base_manifest.nodes
            if dbt_adapter.base_manifest.nodes[nid].resource_type in ("model", "snapshot")
        ]
        envs.append(("base", base_ids, True))

    with Progress(console=console, transient=True) as progress:
        for env_name, node_ids, is_base in envs:
            console.print(f"\n[bold]{env_name}[/bold] environment: {len(node_ids)} models")
            t_start = time.perf_counter()

            manifest = dbt_adapter.base_manifest if is_base else dbt_adapter.curr_manifest
            catalog = dbt_adapter.base_catalog if is_base else dbt_adapter.curr_catalog
            adapter_type = getattr(manifest.metadata, "adapter_type", None) or dbt_adapter.adapter.type()

            success = 0
            fail = 0
            cache_hits = 0
            batch_to_store = []

            task = progress.add_task(f"  {env_name}", total=len(node_ids))

            for nid in node_ids:
                p_list: list = []
                col_names: list = []
                if nid in manifest.nodes:
                    n = manifest.nodes[nid]
                    if hasattr(n.depends_on, "nodes"):
                        p_list = n.depends_on.nodes
                    if catalog and nid in catalog.nodes:
                        col_names = list(catalog.nodes[nid].columns.keys())

                checksum = DbtAdapter._get_node_checksum(manifest, nid)
                parent_checksums = [DbtAdapter._get_node_checksum(manifest, pid) for pid in p_list]
                content_key = DbtAdapter._make_node_content_key(checksum, parent_checksums, col_names, adapter_type)
                cached_json = cache.get_node(nid, content_key)
                if cached_json:
                    cache_hits += 1
                    success += 1
                    progress.advance(task)
                    continue

                try:
                    cll_data = dbt_adapter.get_cll_cached(nid, base=is_base)
                    if cll_data is None:
                        fail += 1
                        progress.advance(task)
                        continue
                    batch_to_store.append((nid, content_key, DbtAdapter._serialize_cll_data(cll_data)))
                    success += 1
                except Exception as e:
                    fail += 1
                    if fail <= 3:
                        console.print(f"  [dim red]  skip: {nid}: {e}[/dim red]")
                    logger.debug("[recce init] CLL computation failed for %s: %s", nid, e)
                progress.advance(task)

            if batch_to_store:
                if not cache.put_nodes_batch(batch_to_store):
                    console.print(
                        f"  [[yellow]Warning[/yellow]] Failed to write {len(batch_to_store)} entries to cache."
                    )

            elapsed = time.perf_counter() - t_start
            computed = len(batch_to_store)
            if cache_hits == len(node_ids) and fail == 0:
                console.print(f"  All {cache_hits} cached, {elapsed:.1f}s")
            else:
                parts = [f"{success} ok"]
                if fail:
                    parts.append(f"{fail} skipped")
                parts.append(f"{elapsed:.1f}s")
                if cache_hits:
                    parts.append(f"{cache_hits} cached")
                if computed:
                    parts.append(f"{computed} computed")
                console.print(f"  {', '.join(parts)}")

            dbt_adapter.get_cll_cached.cache_clear()
            if fail > 3:
                console.print(f"  [dim]... and {fail - 3} more skipped (see logs for details)[/dim]")

    # Build and save the full CLL map as JSON.
    # The per-node SQLite cache is warm from the loop above, so this is fast.
    console.print("\n[bold]Building full CLL map...[/bold]")
    t_map_start = time.perf_counter()
    cll_map_path = Path(cache_db).parent / "cll_map.json"
    try:
        full_cll_map = dbt_adapter.build_full_cll_map()
        cll_map_data = full_cll_map.model_dump(mode="json")
        # Write to temp file first to avoid corrupted JSON on partial write
        tmp_fd, tmp_name = tempfile.mkstemp(dir=cll_map_path.parent, suffix=".tmp")
        try:
            with os.fdopen(tmp_fd, "w") as f:
                json.dump(cll_map_data, f)
            Path(tmp_name).rename(cll_map_path)
        except Exception:
            Path(tmp_name).unlink(missing_ok=True)
            raise
        map_elapsed = time.perf_counter() - t_map_start
        map_size_mb = cll_map_path.stat().st_size / 1024 / 1024
        console.print(
            f"  CLL map saved to [bold]{cll_map_path}[/bold] "
            f"({len(full_cll_map.nodes)} nodes, {len(full_cll_map.columns)} columns, "
            f"{map_size_mb:.1f} MB, {map_elapsed:.1f}s)"
        )
    except Exception as e:
        logger.warning("[recce init] Failed to build CLL map: %s", e)
        console.print(f"  [[yellow]Warning[/yellow]] Failed to build CLL map: {e}")

    stats = cache.stats
    console.print(f"\nCache saved to [bold]{cache_db}[/bold] ({stats['entries']} entries)")

    # In cloud mode, emit per_node.db — a pure-artifact SQLite that Cloud
    # streams to serve lineage without proxying to an ephemeral Recce instance.
    # Also emit info.json + lineage_diff.json — pre-computed artifacts that
    # serve Cloud's /info and /select endpoints without re-computing lineage
    # from raw dbt artifacts on every request.
    # Both scratch dirs are always cleaned up, even on upload failure, so
    # long-lived Cloud deploys don't accumulate recce-per-node-* or
    # recce-metadata-* directories in /tmp on retries.
    if is_cloud:
        per_node_scratch = Path(tempfile.mkdtemp(prefix="recce-per-node-"))
        metadata_scratch = Path(tempfile.mkdtemp(prefix="recce-metadata-"))
        try:
            # Emit info.json + lineage_diff.json up front — these are pure
            # artifact derivations and don't depend on the upload URL keys.
            info_path: Optional[Path] = metadata_scratch / "info.json"
            lineage_diff_path: Optional[Path] = metadata_scratch / "lineage_diff.json"
            console.print("\n[bold]Emitting lineage metadata...[/bold]")
            t_meta_start = time.perf_counter()
            try:
                emit_info_and_lineage_diff(dbt_adapter, info_path, lineage_diff_path)
                meta_elapsed = time.perf_counter() - t_meta_start
                info_size_kb = info_path.stat().st_size / 1024
                lineage_diff_size_kb = lineage_diff_path.stat().st_size / 1024
                console.print(
                    f"  Metadata emitted "
                    f"(info.json {info_size_kb:.1f} KB, lineage_diff.json {lineage_diff_size_kb:.1f} KB, "
                    f"{meta_elapsed:.1f}s)"
                )
            except Exception as e:
                logger.warning("[recce init] Failed to emit metadata artifacts: %s", e)
                console.print(f"  [[yellow]Warning[/yellow]] Failed to emit metadata artifacts: {e}")
                info_path = None
                lineage_diff_path = None

            if cloud_client:
                console.print("\n[bold]Uploading results to Cloud...[/bold]")
                upload_failures: list[str] = []
                upload_urls: Optional[dict] = None
                try:
                    upload_urls = cloud_client.get_upload_urls_by_session_id(cloud_org_id, cloud_project_id, session_id)
                except Exception as e:
                    logger.warning("[recce init] Cloud upload failed: %s", e)
                    console.print(f"  [[yellow]Warning[/yellow]] Cloud upload failed: {e}")

                if upload_urls is not None:
                    # Emit per_node.db only when Cloud declares support for it.
                    # Against an older Cloud without per_node_db_url, emitting
                    # the SQLite file is pure waste — it is a cloud-only
                    # artifact with no local consumer.
                    per_node_db_upload_url = upload_urls.get("per_node_db_url")
                    per_node_db_path: Optional[Path] = None
                    if per_node_db_upload_url:
                        per_node_db_path = per_node_scratch / "per_node.db"
                        console.print("\n[bold]Emitting per-node SQLite...[/bold]")
                        t_pn_start = time.perf_counter()
                        try:
                            with PerNodeDbWriter(per_node_db_path) as writer:
                                writer.write_meta(
                                    schema_version=str(PER_NODE_DB_SCHEMA_VERSION),
                                    session_id=session_id or "",
                                    recce_version=__version__,
                                    generated_at=str(int(time.time())),
                                )
                                # Use has_target / has_base to match the CLL
                                # cache loop above. When only one env has
                                # artifacts, context_kwargs path-swaps the
                                # missing path to the present one so
                                # load_context doesn't fail — so both manifests
                                # are non-None but represent the SAME env. The
                                # flags are the only truth about which env
                                # actually has artifacts.
                                envs_to_emit = []
                                if has_target:
                                    envs_to_emit.append(
                                        (
                                            "current",
                                            dbt_adapter.curr_manifest,
                                            dbt_adapter.curr_catalog,
                                            dbt_adapter.base_catalog,
                                        )
                                    )
                                if has_base:
                                    envs_to_emit.append(
                                        (
                                            "base",
                                            dbt_adapter.base_manifest,
                                            dbt_adapter.base_catalog,
                                            dbt_adapter.curr_catalog,
                                        )
                                    )

                                def _to_dict(artifact):
                                    return (
                                        artifact.to_dict()
                                        if (artifact is not None and hasattr(artifact, "to_dict"))
                                        else artifact
                                    )

                                for env_name, manifest, catalog, cross_catalog in envs_to_emit:
                                    if manifest is None:
                                        continue
                                    manifest_dict = manifest.to_dict() if hasattr(manifest, "to_dict") else manifest
                                    catalog_dict = _to_dict(catalog)
                                    cross_catalog_dict = _to_dict(cross_catalog)
                                    node_rows, column_rows, edge_rows, test_rows = extract_rows_from_artifacts(
                                        manifest_dict,
                                        catalog_dict,
                                        env_name,
                                        cross_env_catalog=cross_catalog_dict,
                                    )
                                    writer.write_nodes(node_rows)
                                    writer.write_columns(column_rows)
                                    writer.write_edges(edge_rows)
                                    writer.write_tests(test_rows)
                            pn_elapsed = time.perf_counter() - t_pn_start
                            pn_size_mb = per_node_db_path.stat().st_size / 1024 / 1024
                            console.print(f"  per_node.db emitted " f"({pn_size_mb:.1f} MB, {pn_elapsed:.1f}s)")
                        except Exception as e:
                            logger.warning("[recce init] Failed to emit per_node.db: %s", e)
                            console.print(f"  [[yellow]Warning[/yellow]] Failed to emit per_node.db: {e}")
                            per_node_db_path = None
                    else:
                        console.print(
                            "  [[yellow]Warning[/yellow]] No per_node_db_url in upload URLs "
                            "(Cloud server may need update) — skipping per_node.db emit"
                        )

                    # Upload CLL map
                    cll_map_upload_url = upload_urls.get("cll_map_url")
                    if cll_map_upload_url and cll_map_path.is_file():
                        try:
                            with open(cll_map_path, "rb") as f:
                                resp = requests.put(
                                    cll_map_upload_url,
                                    data=f,
                                    headers={"Content-Type": "application/json"},
                                    timeout=_UPLOAD_TIMEOUT,
                                )
                            if resp.status_code in (200, 204):
                                console.print(
                                    f"  Uploaded cll_map.json ({cll_map_path.stat().st_size / 1024 / 1024:.1f} MB)"
                                )
                            else:
                                upload_failures.append("cll_map.json")
                                console.print(
                                    f"  [[yellow]Warning[/yellow]] Failed to upload cll_map.json: "
                                    f"HTTP {resp.status_code}"
                                )
                        except requests.RequestException as e:
                            upload_failures.append("cll_map.json")
                            console.print(f"  [[yellow]Warning[/yellow]] Failed to upload cll_map.json: {e}")
                    elif not cll_map_upload_url:
                        console.print(
                            "  [[yellow]Warning[/yellow]] No cll_map_url in upload URLs "
                            "(Cloud server may need update)"
                        )

                    # Upload per_node.db (only when Cloud supports it AND we emitted).
                    if per_node_db_upload_url and per_node_db_path and per_node_db_path.is_file():
                        try:
                            with open(per_node_db_path, "rb") as f:
                                resp = requests.put(
                                    per_node_db_upload_url,
                                    data=f,
                                    headers={"Content-Type": "application/octet-stream"},
                                    timeout=_UPLOAD_TIMEOUT,
                                )
                            if resp.status_code in (200, 204):
                                console.print(
                                    f"  Uploaded per_node.db "
                                    f"({per_node_db_path.stat().st_size / 1024 / 1024:.1f} MB)"
                                )
                            else:
                                upload_failures.append("per_node.db")
                                console.print(
                                    f"  [[yellow]Warning[/yellow]] Failed to upload per_node.db: "
                                    f"HTTP {resp.status_code}"
                                )
                        except requests.RequestException as e:
                            upload_failures.append("per_node.db")
                            console.print(f"  [[yellow]Warning[/yellow]] Failed to upload per_node.db: {e}")

                    # Upload CLL cache. cll_cache.db is load-bearing across sessions —
                    # build_full_cll_map reuses its warm entries on subsequent runs —
                    # so Cloud uploads it alongside per_node.db.
                    cll_cache_upload_url = upload_urls.get("cll_cache_url")
                    if cll_cache_upload_url and Path(cache_db).is_file():
                        try:
                            with open(cache_db, "rb") as f:
                                resp = requests.put(
                                    cll_cache_upload_url,
                                    data=f,
                                    headers={"Content-Type": "application/octet-stream"},
                                    timeout=_UPLOAD_TIMEOUT,
                                )
                            if resp.status_code in (200, 204):
                                console.print(
                                    f"  Uploaded cll_cache.db "
                                    f"({Path(cache_db).stat().st_size / 1024 / 1024:.1f} MB)"
                                )
                            else:
                                upload_failures.append("cll_cache.db")
                                console.print(
                                    f"  [[yellow]Warning[/yellow]] Failed to upload cll_cache.db: "
                                    f"HTTP {resp.status_code}"
                                )
                        except requests.RequestException as e:
                            upload_failures.append("cll_cache.db")
                            console.print(f"  [[yellow]Warning[/yellow]] Failed to upload cll_cache.db: {e}")
                    elif not cll_cache_upload_url:
                        logger.debug("No cll_cache_url in upload URLs — cache upload not supported yet")

                    # Upload info.json and lineage_diff.json. Graceful
                    # degradation: if Cloud hasn't added the info_url /
                    # lineage_diff_url keys yet, log a warning and continue —
                    # keeps old CLI + new Cloud (and vice versa) compatible.
                    metadata_uploads = [
                        ("info.json", info_path, "info_url"),
                        ("lineage_diff.json", lineage_diff_path, "lineage_diff_url"),
                    ]
                    for display_name, local_path, url_key in metadata_uploads:
                        metadata_upload_url = upload_urls.get(url_key)
                        if metadata_upload_url and local_path is not None and local_path.is_file():
                            try:
                                with open(local_path, "rb") as f:
                                    resp = requests.put(
                                        metadata_upload_url,
                                        data=f,
                                        headers={"Content-Type": "application/json"},
                                        timeout=_UPLOAD_TIMEOUT,
                                    )
                                if resp.status_code in (200, 204):
                                    size_kb = local_path.stat().st_size / 1024
                                    console.print(f"  Uploaded {display_name} ({size_kb:.1f} KB)")
                                else:
                                    upload_failures.append(display_name)
                                    console.print(
                                        f"  [[yellow]Warning[/yellow]] Failed to upload {display_name}: "
                                        f"HTTP {resp.status_code}"
                                    )
                            except requests.RequestException as e:
                                upload_failures.append(display_name)
                                console.print(f"  [[yellow]Warning[/yellow]] Failed to upload {display_name}: {e}")
                        elif metadata_upload_url and (local_path is None or not local_path.is_file()):
                            # URL present but local artifact missing — emit failed
                            # partway (e.g., info.json written but lineage_diff.json
                            # write raised). Record the failure so the summary
                            # surfaces it instead of printing a misleading
                            # "Cloud upload complete."
                            upload_failures.append(display_name)
                            console.print(
                                f"  [[yellow]Warning[/yellow]] Skipping upload of {display_name}: "
                                "local artifact missing (emission failed)"
                            )
                        elif not metadata_upload_url:
                            console.print(
                                f"  [[yellow]Warning[/yellow]] No {url_key} in upload URLs "
                                "(Cloud server may need update)"
                            )

                    if upload_failures:
                        console.print(
                            f"[bold yellow]Cloud upload completed with warnings[/bold yellow] "
                            f"(failed: {', '.join(upload_failures)})"
                        )
                    else:
                        console.print("[bold green]Cloud upload complete.[/bold green]")
        finally:
            # Always remove both scratch dirs — they are throwaway per
            # invocation. cll_cache.db lives at ~/.recce/cll_cache.db (or the
            # user-provided --cache-db) and is NOT touched here.
            shutil.rmtree(per_node_scratch, ignore_errors=True)
            shutil.rmtree(metadata_scratch, ignore_errors=True)
    else:
        console.print("Run [bold]recce server --enable-cll-cache[/bold] to use the cached lineage.")


@cli.command(cls=TrackCommand)
@add_options(dbt_related_options)
@add_options(recce_dbt_artifact_dir_options)
def debug(**kwargs):
    """
    Diagnose and verify Recce setup for the development and the base environments
    """

    from rich.console import Console

    from recce.adapter.dbt_adapter import DbtAdapter
    from recce.core import load_context

    console = Console()

    def check_artifacts(env_name, target_path):
        console.rule(f"{env_name} Environment", style="orange3")
        if not target_path.is_dir():
            console.print(f"[[red]MISS[/red]] Directory not found: {target_path}")
            return [False, False, False]

        console.print(f"[[green]OK[/green]] Directory exists: {target_path}")

        manifest_path = target_path / "manifest.json"
        manifest_is_ready = manifest_path.is_file()
        if manifest_is_ready:
            console.print(f"[[green]OK[/green]] Manifest JSON file exists : {manifest_path}")
        else:
            console.print(f"[[red]MISS[/red]] Manifest JSON file not found: {manifest_path}")

        catalog_path = target_path / "catalog.json"
        catalog_is_ready = catalog_path.is_file()
        if catalog_is_ready:
            console.print(f"[[green]OK[/green]] Catalog JSON file exists: {catalog_path}")
        else:
            console.print(f"[[red]MISS[/red]] Catalog JSON file not found: {catalog_path}")

        return [True, manifest_is_ready, catalog_is_ready]

    project_dir_path = Path(kwargs.get("project_dir") or "./")
    target_path = project_dir_path.joinpath(Path(kwargs.get("target_path", "target")))
    target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))

    curr_is_ready = check_artifacts("Development", target_path)
    base_is_ready = check_artifacts("Base", target_base_path)

    console.rule("Warehouse Connection", style="orange3")
    conn_is_ready = True
    try:
        context_kwargs = {**kwargs, "target_base_path": kwargs.get("target_path")}
        ctx = load_context(**context_kwargs)
        dbt_adapter: DbtAdapter = ctx.adapter
        sql = dbt_adapter.generate_sql("select 1", False)
        dbt_adapter.execute(sql, fetch=True, auto_begin=True)
        console.print("[[green]OK[/green]] Connection test")
    except Exception:
        conn_is_ready = False
        console.print("[[red]FAIL[/red]] Connection test")

    console.rule("Result", style="orange3")
    if all(curr_is_ready) and all(base_is_ready) and conn_is_ready:
        console.print("[[green]OK[/green]] Ready to launch! Type 'recce server'.")
    elif all(curr_is_ready) and conn_is_ready:
        console.print("[[orange3]OK[/orange3]] Ready to launch with [i]limited features[/i]. Type 'recce server'.")

    if not curr_is_ready[0]:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt or overwrite the default directory of the development environment with '--target-path'."
        )
    else:
        if not curr_is_ready[1]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt run' to generate the manifest JSON file for the development environment."
            )
        if not curr_is_ready[2]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt docs generate' to generate the catalog JSON file for the development environment."
            )

    if not base_is_ready[0]:
        console.print(
            "[[orange3]TIP[/orange3]] Run dbt with '--target-path target-base' or overwrite the default directory of the base environment with '--target-base-path'."
        )
    else:
        if not base_is_ready[1]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt run --target-path target-base' to generate the manifest JSON file for the base environment."
            )
        if not base_is_ready[2]:
            console.print(
                "[[orange3]TIP[/orange3]] 'dbt docs generate --target-path target-base' to generate the catalog JSON file for the base environment."
            )

    if not conn_is_ready:
        console.print("[[orange3]TIP[/orange3]] Run 'dbt debug' to check the connection.")


@cli.command(hidden=True, cls=TrackCommand)
@click.option("--sql", help="Sql template to query", required=True)
@click.option("--base", is_flag=True, help="Run the query on the base environment")
@add_options(dbt_related_options)
def query(sql, base: bool = False, **kwargs):
    """
    Run a query on the current or base environment

    Examples:\n

    - run an adhoc query\n
        recce query --sql 'select * from {{ ref("mymodel") }} order by 1'

    - run an adhoc query on base environment\n
        recce query --base --sql 'select * from {{ ref("mymodel") }} order by 1'
    """
    from .core import RecceContext

    context = RecceContext.load(**kwargs)
    result = _execute_sql(context, sql, base=base)
    print(result.to_string(na_rep="-", index=False))


def _split_comma_separated(ctx, param, value):
    return value.split(",") if value else None


@cli.command(hidden=True, cls=TrackCommand)
@click.option("--sql", help="Sql template to query.", required=True)
@click.option(
    "--primary-keys",
    type=click.STRING,
    help="Comma-separated list of primary key columns.",
    callback=_split_comma_separated,
)
@click.option("--keep-shape", is_flag=True, help="Keep unchanged columns. Otherwise, unchanged columns are hidden.")
@click.option(
    "--keep-equal", is_flag=True, help='Keep values that are equal. Otherwise, equal values are shown as "-".'
)
@add_options(dbt_related_options)
def diff(sql, primary_keys: List[str] = None, keep_shape: bool = False, keep_equal: bool = False, **kwargs):
    """
    Run queries on base and current environments and diff the results

    Examples:\n

    - run adhoc queries and diff the results\n
        recce diff --sql 'select * from {{ ref("mymodel") }} order by 1'
    """

    from .core import RecceContext

    context = RecceContext.load(**kwargs)
    before = _execute_sql(context, sql, base=True)
    if primary_keys is not None:
        before.set_index(primary_keys, inplace=True)
    after = _execute_sql(context, sql, base=False)
    if primary_keys is not None:
        after.set_index(primary_keys, inplace=True)

    before_aligned, after_aligned = before.align(after)
    diff = before_aligned.compare(
        after_aligned, result_names=("base", "current"), keep_equal=keep_equal, keep_shape=keep_shape
    )
    print(diff.to_string(na_rep="-") if not diff.empty else "no changes")


@cli.command(cls=TrackCommand)
@click.argument("state_file", required=False)
@click.option("--host", default="localhost", show_default=True, help="The host to bind to.")
@click.option("--port", default=8000, show_default=True, help="The port to bind to.", type=int)
@click.option("--lifetime", default=0, show_default=True, help="The lifetime of the server in seconds.", type=int)
@click.option(
    "--idle-timeout",
    default=0,
    show_default=True,
    help="The idle timeout in seconds. If 0, idle timeout is disabled. Maximum value is capped by lifetime.",
    type=int,
)
@click.option("--review", is_flag=True, help="Open the state file in the review mode.")
@click.option("--single-env", is_flag=True, help="Launch in single environment mode directly.")
@click.option(
    "--enable-cll-cache",
    is_flag=True,
    help="Enable the pre-cached full column-level lineage map.",
    envvar="ENABLE_CLL_CACHE",
)
@click.option(
    "--impact-at-startup",
    is_flag=True,
    help="Automatically run impact analysis when the UI loads.",
    envvar="RECCE_IMPACT_AT_STARTUP",
    hidden=True,
)
@click.option(
    "--new-cll-experience",
    is_flag=True,
    help="Enable the new column-level lineage visual experience.",
    envvar="RECCE_NEW_CLL_EXPERIENCE",
)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@add_options(recce_hidden_options)
def server(host, port, lifetime, idle_timeout=0, state_file=None, **kwargs):
    """
    Launch the recce server

    STATE_FILE is the path to the recce state file. Defaults=None, which will be no persistent state.

    Examples:\n

    \b
    # Launch the recce server
    recce server

    \b
    # Launch the recce server with a state file
    recce server recce_state.json

    \b
    # Launch the server in the review mode
    recce server --review recce_state.json

    \b
    # Launch the server using the state from the PR of your current branch. (Requires GitHub token)
    export GITHUB_TOKEN=<your-github-token>
    recce server --cloud
    recce server --review --cloud

    """

    import uvicorn
    from rich.console import Console
    from rich.prompt import Confirm

    from recce.config import RecceConfig
    from recce.exceptions import RecceConfigException
    from recce.server import RecceServerMode
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message

    from .server import AppState, app

    RecceConfig(config_file=kwargs.get("config"))

    # Initialize startup performance tracking
    from recce.util.startup_perf import StartupPerfTracker, set_startup_tracker

    startup_tracker = StartupPerfTracker()
    set_startup_tracker(startup_tracker)

    handle_debug_flag(**kwargs)
    patch_derived_args(kwargs)

    server_mode = kwargs.get("mode") if kwargs.get("mode") else RecceServerMode.server
    is_review = kwargs.get("review", False)
    is_cloud = kwargs.get("cloud", False)
    startup_tracker.set_cloud_mode(is_cloud)
    flag = {
        "single_env_onboarding": False,
        "show_relaunch_hint": False,
        "preview": False,
        "read_only": False,
        "disable_cll_cache": True,
        "impact_at_startup": False,
        "new_cll_experience": False,
    }
    console = Console()

    # Prepare API token
    try:
        api_token = prepare_api_token(**kwargs)
        kwargs["api_token"] = api_token
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)
    auth_options = {
        "api_token": api_token,
    }

    # Check Single Environment Onboarding Mode if not in cloud mode and not in review mode
    if not is_cloud and not is_review:
        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))
        if not target_base_path.is_dir():
            # Mark as single env onboarding mode if user provides the target-path only
            flag["single_env_onboarding"] = True
            flag["show_relaunch_hint"] = True
            # Use the target path as the base path
            kwargs["target_base_path"] = kwargs.get("target_path")

    # Server mode:
    #
    # It's used to determine the features disabled in the Web UI. Only used in the cloud-managed recce instances.
    #
    # Read-Only: No run query, no checklist
    # Preview (Metadata-Only): No run query
    if server_mode == RecceServerMode.preview:
        flag["preview"] = True
    elif server_mode == RecceServerMode.read_only:
        flag["read_only"] = True

    if kwargs.get("enable_cll_cache", False):
        flag["disable_cll_cache"] = False
        from recce.util.cll import CllCache, set_cll_cache

        cache_db = os.environ.get("CLL_CACHE_DB", None)
        if cache_db is None:
            from recce.util.cll import _DEFAULT_DB_PATH

            cache_db = _DEFAULT_DB_PATH
        set_cll_cache(CllCache(db_path=cache_db))

    if kwargs.get("impact_at_startup", False):
        flag["impact_at_startup"] = True

    if kwargs.get("new_cll_experience", False):
        flag["new_cll_experience"] = True

    # Create state loader using shared function
    from recce.util.startup_perf import get_startup_tracker

    state_loader = create_state_loader_by_args(state_file, **kwargs)

    if (tracker := get_startup_tracker()) and hasattr(state_loader, "catalog"):
        tracker.set_catalog_type(state_loader.catalog)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    if state_loader.review_mode:
        console.rule("Recce Server : Review Mode")
    elif flag.get("single_env_onboarding"):
        # Show warning message
        console.rule("Notice", style="orange3")
        console.print(
            "Recce will launch with limited features (no environment comparison).\n"
            "\n"
            "For full functionality, set up a base environment first.\n"
            "Setup help: 'recce debug' or https://docs.reccehq.com/configure-diff/\n"
        )

        single_env_flag = kwargs.get("single_env", False)
        if not single_env_flag:
            lanch_in_single_env = Confirm.ask("Continue to launch Recce?")
            if not lanch_in_single_env:
                exit(0)

        console.rule("Recce Server : Limited Features")
    else:
        console.rule("Recce Server")

    # Validate idle_timeout: cap at lifetime if it exceeds lifetime
    if idle_timeout > 0:
        # If lifetime is set (> 0) and idle_timeout exceeds it, cap to lifetime
        if lifetime > 0 and idle_timeout > lifetime:
            effective_idle_timeout = lifetime
            console.print(
                f"[[yellow]Warning[/yellow]] idle_timeout ({idle_timeout}s) exceeds lifetime ({lifetime}s). "
                f"Capping idle_timeout to {effective_idle_timeout}s."
            )
        else:
            # Use idle_timeout as-is (either lifetime is 0, or idle_timeout <= lifetime)
            effective_idle_timeout = idle_timeout
    else:
        # idle_timeout is 0 or negative, disable idle timeout
        effective_idle_timeout = 0

    state = AppState(
        command=server_mode,
        state_loader=state_loader,
        kwargs=kwargs,
        flag=flag,
        auth_options=auth_options,
        lifetime=lifetime,
        idle_timeout=effective_idle_timeout,
        share_url=kwargs.get("share_url"),
        organization_name=os.environ.get("RECCE_SESSION_ORGANIZATION_NAME"),
        web_url=os.environ.get("RECCE_CLOUD_WEB_URL"),
    )
    app.state = state

    uvicorn.run(app, host=host, port=port, lifespan="on")


DEFAULT_RECCE_STATE_FILE = "recce_state.json"


@cli.command(cls=TrackCommand)
@click.option(
    "-o",
    "--output",
    help="Path of the output state file.",
    type=click.Path(),
    default=DEFAULT_RECCE_STATE_FILE,
    show_default=True,
)
@click.option("--state-file", help="Path of the import state file.", type=click.Path())
@click.option("--summary", help="Path of the summary markdown file.", type=click.Path())
@click.option("--skip-query", is_flag=True, help="Skip running the queries for the checks.")
@click.option("--skip-check", is_flag=True, help="Skip running the checks.")
@click.option(
    "--git-current-branch",
    help="The git branch of the current environment.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
)
@click.option(
    "--git-base-branch", help="The git branch of the base environment.", type=click.STRING, envvar="GITHUB_BASE_REF"
)
@click.option(
    "--github-pull-request-url", help="The github pull request url to use for the lineage.", type=click.STRING
)
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@add_options(recce_hidden_options)
def run(output, **kwargs):
    """
    Run recce and output the state file

    Examples:\n

    \b
    # Run recce and output to the default path [recce_state.json]
    recce run

    \b
    # Run recce and output to the specified path
    recce run -o my_recce_state.json

    \b
    # Run recce and output to the specified path
    recce run --cloud --cloud-token <token> --password <password>

    """
    import asyncio

    from rich.console import Console

    from recce.config import RecceConfig
    from recce.exceptions import RecceConfigException
    from recce.run import check_github_ci_env, cli_run
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message

    from .core import RecceContext

    handle_debug_flag(**kwargs)
    console = Console()
    is_github_action, pr_url = check_github_ci_env(**kwargs)
    if is_github_action is True and pr_url is not None:
        kwargs["github_pull_request_url"] = pr_url

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    patch_derived_args(kwargs)
    # Remove share_url from kwargs to avoid affecting state loader creation
    kwargs.pop("share_url", None)

    state_file = kwargs.pop("state_file", None)

    # Prepare API token
    try:
        api_token = prepare_api_token(**kwargs)
        kwargs["api_token"] = api_token
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    # Create state loader using shared function
    state_loader = create_state_loader_by_args(state_file, **kwargs)

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    result, message = RecceContext.verify_required_artifacts(**kwargs)
    if not result:
        console.print(f"[[red]Error[/red]] {message}")
        exit(1)

    # Verify the output state file path
    try:
        if os.path.isdir(output) or output.endswith("/"):

            output_dir = Path(output)
            # Create the directory if not exists
            output_dir.mkdir(parents=True, exist_ok=True)
            output = os.path.join(output, DEFAULT_RECCE_STATE_FILE)
            console.print(
                f"[[yellow]Warning[/yellow]] The path '{output_dir}' is a directory. "
                f"The state file will be saved as '{output}'."
            )
        else:
            # Create the parent directory if not exists
            output_dir = Path(output).parent
            output_dir.mkdir(parents=True, exist_ok=True)
    except FileExistsError as e:
        console.print(f"[[red]Error[/red]] Failed to access file path '{output}'.")
        console.print(f"Reason: {e}")
        exit(1)

    return asyncio.run(cli_run(output, state_loader=state_loader, **kwargs))


@cli.command(cls=TrackCommand)
@click.argument("state_file", required=False)
@click.option(
    "--format",
    "-f",
    help="Output format. Currently only markdown is supported.",
    type=click.Choice(["markdown", "mermaid", "check"], case_sensitive=False),
    default="markdown",
    show_default=True,
    hidden=True,
)
@add_options(dbt_related_options)
@add_options(recce_options)
@add_options(recce_cloud_options)
def summary(state_file, **kwargs):
    """
    Generate a summary of the recce state file
    """
    from rich.console import Console

    from recce.summary import generate_markdown_summary

    from .core import load_context

    handle_debug_flag(**kwargs)
    console = Console()
    cloud_mode = kwargs.get("cloud", False)
    cloud_options = (
        {
            "host": kwargs.get("state_file_host"),
            "github_token": kwargs.get("cloud_token"),
            "password": kwargs.get("password"),
        }
        if cloud_mode
        else None
    )

    state_loader = create_state_loader(
        review_mode=True, cloud_mode=cloud_mode, state_file=state_file, cloud_options=cloud_options
    )
    state_loader.load()

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)
    try:
        # Load context in review mode, won't need to check dbt_project.yml file.
        ctx = load_context(**kwargs, state_loader=state_loader, review=True)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to generate summary")
        console.print(f"{e}")
        exit(1)

    output = generate_markdown_summary(ctx, summary_format=kwargs.get("format"))
    print(output)


@cli.command(cls=TrackCommand)
def connect_to_cloud():
    """
    Connect OSS to Cloud
    """
    import webbrowser

    from rich.console import Console

    from recce.connect_to_cloud import (
        generate_key_pair,
        prepare_connection_url,
        run_one_time_http_server,
    )

    console = Console()

    # Prepare RSA keys for connecting to cloud
    private_key, public_key = generate_key_pair()

    connect_url, callback_port = prepare_connection_url(public_key)
    console.rule("Connecting to Recce Cloud")
    console.print("Attempting to automatically open the Recce Cloud authorization page in your default browser.")
    console.print("If the browser does not open, please open the following URL:")
    console.print(connect_url)
    webbrowser.open(connect_url)

    # Launch a callback HTTP server for fetching the api-token
    run_one_time_http_server(private_key, port=callback_port)


@cli.group("cloud", short_help="Manage Recce Cloud state file.")
def cloud(**kwargs):
    # Manage Recce Cloud.
    pass


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Purge the state file directly.", is_flag=True)
@add_options(recce_options)
def purge(**kwargs):
    """
    Purge the state file from cloud
    """
    from rich.console import Console

    from recce.state import RecceCloudStateManager

    handle_debug_flag(**kwargs)
    console = Console()
    state_loader = None
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }
    force_to_purge = kwargs.get("force", False)

    try:
        console.rule("Check Recce State from Cloud")
        state_loader = create_state_loader(
            review_mode=False, cloud_mode=True, state_file=None, cloud_options=cloud_options
        )
        state_loader.load()
    except Exception:
        console.print("[[yellow]Skip[/yellow]] Cannot access existing state file from cloud. Purge it directly.")

    if state_loader is None:
        try:
            if force_to_purge is True or click.confirm("\nDo you want to purge the state file?"):
                rc, err_msg = RecceCloudStateManager(cloud_options).purge_cloud_state()
                if rc is True:
                    console.rule("Purged Successfully")
                else:
                    console.rule("Failed to Purge", style="red")
                    console.print(f"Reason: {err_msg}")

        except click.exceptions.Abort:
            pass
        return 0

    info = state_loader.info()
    if info is None:
        console.print("[[yellow]Skip[/yellow]] No state file found in cloud.")
        return 0

    pr_info = info.get("pull_request")
    console.print("[green]State File hosted by[/green]", info.get("source"))
    console.print("[green]GitHub Repository[/green]", info.get("pull_request").repository)
    console.print(f"[green]GitHub Pull Request[/green]\n{pr_info.title} #{pr_info.id}")
    console.print(f"Branch merged into [blue]{pr_info.base_branch}[/blue] from [blue]{pr_info.branch}[/blue]")
    console.print(pr_info.url)

    try:
        if force_to_purge is True or click.confirm("\nDo you want to purge the state file?"):
            response = state_loader.purge()
            if response is True:
                console.rule("Purged Successfully")
            else:
                console.rule("Failed to Purge", style="red")
                console.print(f"Reason: {state_loader.error_message}")
    except click.exceptions.Abort:
        pass

    return 0


@cloud.command(cls=TrackCommand)
@click.argument("state_file", type=click.Path(exists=True))
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@add_options(recce_options)
def upload(state_file, **kwargs):
    """
    Upload the state file to cloud
    """
    from rich.console import Console

    from recce.state import RecceCloudStateManager

    handle_debug_flag(**kwargs)
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }

    console = Console()

    # load local state
    state_loader = create_state_loader(
        review_mode=False, cloud_mode=False, state_file=state_file, cloud_options=cloud_options
    )
    state_loader.load()

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if cloud_state_file_exists and not click.confirm("\nDo you want to overwrite the existing state file?"):
        return 0

    console.print(state_manager.upload_state_to_cloud(state_loader.state))


@cloud.command(cls=TrackCommand)
@click.option(
    "-o",
    "--output",
    help="Path of the downloaded state file.",
    type=click.STRING,
    default=DEFAULT_RECCE_STATE_FILE,
    show_default=True,
)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--state-file-host",
    help="The host to fetch the state file from.",
    type=click.STRING,
    envvar="RECCE_STATE_FILE_HOST",
    default="",
    hidden=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the state file in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
)
@add_options(recce_options)
def download(**kwargs):
    """
    Download the state file to cloud
    """
    from rich.console import Console

    from recce.state import RecceCloudStateManager

    handle_debug_flag(**kwargs)
    filepath = kwargs.get("output")
    cloud_options = {
        "host": kwargs.get("state_file_host"),
        "github_token": kwargs.get("cloud_token"),
        "password": kwargs.get("password"),
    }

    console = Console()

    # check if state exists in cloud
    state_manager = RecceCloudStateManager(cloud_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    cloud_state_file_exists = state_manager.check_cloud_state_exists()

    if not cloud_state_file_exists:
        console.print("[yellow]Skip[/yellow] No state file found in cloud.")
        return 0

    state_manager.download_state_from_cloud(filepath)
    console.print(f'Downloaded state file to "{filepath}"')


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the provided artifacts. Defaults to current branch.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
)
@click.option(
    "--target-path",
    help="dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to encrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@add_options(recce_options)
def upload_artifacts(**kwargs):
    """
    Upload the dbt artifacts to cloud

    Upload the dbt artifacts (metadata.json, catalog.json) to Recce Cloud for the given branch.
    The password is used to encrypt the dbt artifacts in the cloud. You will need the password to download the dbt artifacts.

    By default, the artifacts are uploaded to the current branch. You can specify the branch using the --branch option.
    The target path is set to 'target' by default. You can specify the target path using the --target-path option.
    """
    from rich.console import Console

    from recce.artifact import upload_dbt_artifacts
    from recce.git import current_branch

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch") or current_branch()

    try:
        rc = upload_dbt_artifacts(
            target_path, branch=branch, token=cloud_token, password=password, debug=kwargs.get("debug", False)
        )
        console.rule("Uploaded Successfully")
        console.print(
            f'Uploaded dbt artifacts to Recce Cloud for branch "{branch}" from "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Upload", style="red")
        console.print("[[red]Error[/red]] Failed to upload the dbt artifacts to cloud.")
        console.print(f"Reason: {e}")
        rc = 1
    return rc


def _download_artifacts(branch, cloud_token, console, kwargs, password, target_path):
    from recce.artifact import download_dbt_artifacts

    try:
        rc = download_dbt_artifacts(
            target_path,
            branch=branch,
            token=cloud_token,
            password=password,
            force=kwargs.get("force", False),
            debug=kwargs.get("debug", False),
        )
        console.rule("Downloaded Successfully")
        console.print(
            f'Downloaded dbt artifacts from Recce Cloud for branch "{branch}" to "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Download", style="red")
        console.print("[[red]Error[/red]] Failed to download the dbt artifacts from cloud.")
        reason = str(e)

        if (
            "Requests specifying Server Side Encryption with Customer provided keys must provide the correct secret key"
            in reason
        ):
            console.print("Reason: Decryption failed due to incorrect password.")
            console.print(
                "Please provide the correct password to decrypt the dbt artifacts. Or re-upload the dbt artifacts with a new password."
            )
        elif "The specified key does not exist" in reason:
            console.print("Reason: The dbt artifacts is not found in the cloud.")
            console.print("Please upload the dbt artifacts to the cloud before downloading it.")
        else:
            console.print(f"Reason: {reason}")
        rc = 1
    return rc


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the selected artifacts. Defaults to current branch.",
    type=click.STRING,
    envvar="GITHUB_BASE_REF",
)
@click.option(
    "--target-path",
    help="The dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to decrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Download the artifacts directly.", is_flag=True)
@add_options(recce_options)
def download_artifacts(**kwargs):
    """
    Download the dbt artifacts from cloud

    Download the dbt artifacts (metadata.json, catalog.json) from Recce Cloud for the given branch.
    The password is used to decrypt the dbt artifacts in the cloud.

    By default, the artifacts are downloaded from the current branch. You can specify the branch using the --branch option.
    The target path is set to 'target' by default. You can specify the target path using the --target-path option.
    """
    from rich.console import Console

    from recce.git import current_branch

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch") or current_branch()
    return _download_artifacts(branch, cloud_token, console, kwargs, password, target_path)


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch of the selected artifacts. Defaults to default branch.",
    type=click.STRING,
    envvar="GITHUB_BASE_REF",
)
@click.option(
    "--target-path",
    help="The dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target-base",
    show_default=True,
)
@click.option(
    "--password",
    "-p",
    help="The password to decrypt the dbt artifacts in cloud.",
    type=click.STRING,
    envvar="RECCE_STATE_PASSWORD",
    required=True,
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Download the artifacts directly.", is_flag=True)
@add_options(recce_options)
def download_base_artifacts(**kwargs):
    """
    Download the base dbt artifacts from cloud

    Download the base dbt artifacts (metadata.json, catalog.json) from Recce Cloud.
    This is useful when you start to set up the base dbt artifacts for the first time.

    Please make sure you have uploaded the dbt artifacts before downloading them.
    """
    from rich.console import Console

    from recce.git import current_default_branch

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    password = kwargs.get("password")
    target_path = kwargs.get("target_path")
    branch = kwargs.get("branch") or current_default_branch()
    # If recce can't infer default branch from "GITHUB_BASE_REF" and current_default_branch()
    if branch is None:
        console.print(
            "[[red]Error[/red]] Please provide your base branch name with '--branch' to download the base " "artifacts."
        )
        exit(1)

    return _download_artifacts(branch, cloud_token, console, kwargs, password, target_path)


@cloud.command(cls=TrackCommand)
@click.option("--cloud-token", help="The GitHub token used by Recce Cloud.", type=click.STRING, envvar="GITHUB_TOKEN")
@click.option(
    "--branch",
    "-b",
    help="The branch to delete artifacts from. Defaults to current branch.",
    type=click.STRING,
    envvar="GITHUB_HEAD_REF",
)
@click.option("--force", "-f", help="Bypasses the confirmation prompt. Delete the artifacts directly.", is_flag=True)
@add_options(recce_options)
def delete_artifacts(**kwargs):
    """
    Delete the dbt artifacts from cloud

    Delete the dbt artifacts (metadata.json, catalog.json) from Recce Cloud for the given branch.
    This will permanently remove the artifacts from the cloud storage.

    By default, the artifacts are deleted from the current branch. You can specify the branch using the --branch option.
    """
    from rich.console import Console

    from recce.artifact import delete_dbt_artifacts
    from recce.git import current_branch
    from recce.util.recce_cloud import RecceCloudException

    console = Console()
    cloud_token = kwargs.get("cloud_token")
    branch = kwargs.get("branch") or current_branch()
    force = kwargs.get("force", False)

    if not force:
        if not click.confirm(f'Do you want to delete artifacts from branch "{branch}"?'):
            console.print("Deletion cancelled.")
            return 0

    try:
        delete_dbt_artifacts(branch=branch, token=cloud_token, debug=kwargs.get("debug", False))
        console.print(f"[[green]Success[/green]] Artifacts deleted from branch: {branch}")
        return 0
    except click.exceptions.Abort:
        pass
    except RecceCloudException as e:
        console.print("[[red]Error[/red]] Failed to delete the dbt artifacts from cloud.")
        console.print(f"Reason: {e.reason}")
        exit(1)
    except Exception as e:
        console.print("[[red]Error[/red]] Failed to delete the dbt artifacts from cloud.")
        console.print(f"Reason: {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-organizations")
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_organizations(**kwargs):
    """
    List organizations from Recce Cloud

    Lists all organizations that the authenticated user has access to.
    """
    from rich.console import Console
    from rich.table import Table

    from recce.exceptions import RecceConfigException
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
    from recce.util.recce_cloud import RecceCloudException

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        organizations = cloud.list_organizations()

        if not organizations:
            console.print("No organizations found.")
            return

        table = Table(title="Organizations")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Display Name", style="yellow")

        for org in organizations:
            table.add_row(str(org.get("id", "")), org.get("name", ""), org.get("display_name", ""))

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-projects")
@click.option(
    "--organization",
    "-o",
    help="Organization ID (can also be set via RECCE_ORGANIZATION_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_ORGANIZATION_ID",
)
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_projects(**kwargs):
    """
    List projects from Recce Cloud

    Lists all projects in the specified organization that the authenticated user has access to.

    Examples:

        # Using environment variable
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-projects

        # Using command line argument
        recce cloud list-projects --organization 8

        # Override environment variable
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-projects --organization 10
    """
    from rich.console import Console
    from rich.table import Table

    from recce.exceptions import RecceConfigException
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
    from recce.util.recce_cloud import RecceCloudException

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    organization = kwargs.get("organization")
    if not organization:
        console.print("[[red]Error[/red]] Organization ID is required. Please provide it via:")
        console.print("  --organization <id> or set RECCE_ORGANIZATION_ID environment variable")
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        projects = cloud.list_projects(organization)

        if not projects:
            console.print(f"No projects found in organization {organization}.")
            return

        table = Table(title=f"Projects in Organization {organization}")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Display Name", style="yellow")

        for project in projects:
            table.add_row(str(project.get("id", "")), project.get("name", ""), project.get("display_name", ""))

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


@cloud.command(cls=TrackCommand, name="list-sessions")
@click.option(
    "--organization",
    "-o",
    help="Organization ID (can also be set via RECCE_ORGANIZATION_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_ORGANIZATION_ID",
)
@click.option(
    "--project",
    "-p",
    help="Project ID (can also be set via RECCE_PROJECT_ID environment variable)",
    type=click.STRING,
    envvar="RECCE_PROJECT_ID",
)
@click.option("--api-token", help="The Recce Cloud API token.", type=click.STRING, envvar="RECCE_API_TOKEN")
@add_options(recce_options)
def list_sessions(**kwargs):
    """
    List sessions from Recce Cloud

    Lists all sessions in the specified project that the authenticated user has access to.

    Examples:

        # Using environment variables
        export RECCE_ORGANIZATION_ID=8
        export RECCE_PROJECT_ID=7
        recce cloud list-sessions

        # Using command line arguments
        recce cloud list-sessions --organization 8 --project 7

        # Mixed usage (env + CLI override)
        export RECCE_ORGANIZATION_ID=8
        recce cloud list-sessions --project 7

        # Override environment variables
        export RECCE_ORGANIZATION_ID=8
        export RECCE_PROJECT_ID=7
        recce cloud list-sessions --organization 10 --project 9
    """
    from rich.console import Console
    from rich.table import Table

    from recce.exceptions import RecceConfigException
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
    from recce.util.recce_cloud import RecceCloudException

    console = Console()
    handle_debug_flag(**kwargs)

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    organization = kwargs.get("organization")
    project = kwargs.get("project")

    # Validate required parameters
    if not organization:
        console.print("[[red]Error[/red]] Organization ID is required. Please provide it via:")
        console.print("  --organization <id> or set RECCE_ORGANIZATION_ID environment variable")
        exit(1)

    if not project:
        console.print("[[red]Error[/red]] Project ID is required. Please provide it via:")
        console.print("  --project <id> or set RECCE_PROJECT_ID environment variable")
        exit(1)

    try:
        from recce.util.recce_cloud import RecceCloud

        cloud = RecceCloud(api_token)
        sessions = cloud.list_sessions(organization, project)

        if not sessions:
            console.print(f"No sessions found in project {project}.")
            return

        table = Table(title=f"Sessions in Project {project}")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="green")
        table.add_column("Is Base", style="yellow")

        for session in sessions:
            is_base = "✓" if session.get("is_base", False) else ""
            table.add_row(session.get("id", ""), session.get("name", ""), is_base)

        console.print(table)

    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)
    except Exception as e:
        console.print(f"[[red]Error[/red]] {e}")
        exit(1)


@cli.group("github", short_help="GitHub related commands", hidden=True)
def github(**kwargs):
    pass


@github.command(
    cls=TrackCommand, short_help="Download the artifacts from the GitHub repository based on the current Pull Request."
)
@click.option(
    "--github-token",
    help="The github token to use for accessing GitHub repo.",
    type=click.STRING,
    envvar="GITHUB_TOKEN",
)
@click.option(
    "--github-repo",
    help="The github repo to use for accessing GitHub repo.",
    type=click.STRING,
    envvar="GITHUB_REPOSITORY",
)
def artifact(**kwargs):
    from recce.github import recce_ci_artifact

    return recce_ci_artifact(**kwargs)


@cli.command(cls=TrackCommand)
@click.argument("state_file", type=click.Path(exists=True))
@click.option(
    "--api-token",
    help="The personal token generated by Recce Cloud.",
    type=click.STRING,
    envvar="RECCE_API_TOKEN",
)
def share(state_file, **kwargs):
    """
    Share the state file
    """
    from click import Abort
    from rich.console import Console

    from recce.exceptions import RecceConfigException
    from recce.state import RecceShareStateManager
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message
    from recce.util.recce_cloud import RecceCloudException

    console = Console()
    handle_debug_flag(**kwargs)
    cloud_options = None

    # read or input the api token
    try:
        api_token = prepare_api_token(interaction=True, **kwargs)
    except Abort:
        console.print("[yellow]Abort[/yellow]")
        exit(0)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    auth_options = {"api_token": api_token}

    # load local state
    state_loader = create_state_loader(
        review_mode=True, cloud_mode=False, state_file=state_file, cloud_options=cloud_options
    )
    state_loader.load()

    if not state_loader.verify():
        error, hint = state_loader.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_manager = RecceShareStateManager(auth_options)
    if not state_manager.verify():
        error, hint = state_manager.error_and_hint
        console.print(f"[[red]Error[/red]] {error}")
        console.print(f"{hint}")
        exit(1)

    # check if state exists in cloud
    state_file_name = os.path.basename(state_file)

    try:
        response = state_manager.share_state(state_file_name, state_loader.state)
        if response.get("status") == "error":
            console.print("[[red]Error[/red]] Failed to share the state.\n" f"Reason: {response.get('message')}")
        else:
            console.print(f"Shared Link: {response.get('share_url')}")
    except RecceCloudException as e:
        console.print(f"[[red]Error[/red]] {e}")
        console.print(f"Reason: {e.reason}")
        exit(1)


snapshot_id_option = click.option(
    "--snapshot-id",
    help="The snapshot ID to upload artifacts to cloud.",
    type=click.STRING,
    envvar=["RECCE_SNAPSHOT_ID", "RECCE_SESSION_ID"],
    required=True,
)

session_id_option = click.option(
    "--session-id",
    help="The session ID to upload artifacts to cloud.",
    type=click.STRING,
    envvar=["RECCE_SESSION_ID", "RECCE_SNAPSHOT_ID"],
    required=True,
)

target_path_option = click.option(
    "--target-path",
    help="dbt artifacts directory for your artifacts.",
    type=click.STRING,
    default="target",
    show_default=True,
)


@cli.command(cls=TrackCommand, hidden=True)
@add_options([session_id_option, target_path_option])
@add_options(recce_cloud_auth_options)
@add_options(recce_options)
def upload_session(**kwargs):
    """
    Upload target/manifest.json and target/catalog.json to the specific session ID

    Upload the dbt artifacts (manifest.json, catalog.json) to Recce Cloud for the given session ID.
    This allows you to associate artifacts with a specific session for later use.

    Examples:\n

    \b
    # Upload artifacts to a session ID
    recce upload-session --session-id <session-id>

    \b
    # Upload artifacts from custom target path to a session ID
    recce upload-session --session-id <session-id> --target-path my-target
    """
    from rich.console import Console

    from recce.artifact import upload_artifacts_to_session
    from recce.config import RecceConfig
    from recce.exceptions import RecceConfigException
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message

    console = Console()
    handle_debug_flag(**kwargs)

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    try:
        api_token = prepare_api_token(**kwargs)
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    session_id = kwargs.get("session_id")
    target_path = kwargs.get("target_path")

    try:
        rc = upload_artifacts_to_session(
            target_path, session_id=session_id, token=api_token, debug=kwargs.get("debug", False)
        )
        console.rule("Uploaded Successfully")
        console.print(
            f'Uploaded dbt artifacts to Recce Cloud for session ID "{session_id}" from "{os.path.abspath(target_path)}"'
        )
    except Exception as e:
        console.rule("Failed to Upload Session", style="red")
        console.print(f"[[red]Error[/red]] Failed to upload the dbt artifacts to the session {session_id}.")
        console.print(f"Reason: {e}")
        rc = 1
    return rc


# Backward compatibility for `recce snapshot` command
@cli.command(
    cls=TrackCommand,
    hidden=True,
    deprecated=True,
    help="Upload target/manifest.json and target/catalog.json to the specific snapshot ID",
)
@add_options([snapshot_id_option, target_path_option])
@add_options(recce_cloud_auth_options)
@add_options(recce_options)
def snapshot(**kwargs):
    kwargs["session_id"] = kwargs.get("snapshot_id")
    return upload_session(**kwargs)


@cli.command(hidden=True, cls=TrackCommand)
@click.argument("state_file", required=True)
@click.option("--host", default="localhost", show_default=True, help="The host to bind to.")
@click.option("--port", default=8000, show_default=True, help="The port to bind to.", type=int)
@click.option("--lifetime", default=0, show_default=True, help="The lifetime of the server in seconds.", type=int)
@click.option("--share-url", help="The share URL triggers this instance.", type=click.STRING, envvar="RECCE_SHARE_URL")
@click.pass_context
def read_only(ctx, state_file=None, **kwargs):
    from recce.server import RecceServerMode

    # Invoke `recce server --mode read-only <state_file> ...
    kwargs["mode"] = RecceServerMode.read_only
    ctx.invoke(server, state_file=state_file, **kwargs)


@cli.command(cls=TrackCommand)
@click.argument("state_file", required=False)
@click.option("--sse", is_flag=True, default=False, help="Start in HTTP/SSE mode instead of stdio mode")
@click.option("--host", default="localhost", help="Host to bind to in SSE mode (default: localhost)")
@click.option("--port", default=8000, type=int, help="Port to bind to in SSE mode (default: 8000)")
@add_options(dbt_related_options)
@add_options(sqlmesh_related_options)
@add_options(recce_options)
@add_options(recce_dbt_artifact_dir_options)
@add_options(recce_cloud_options)
@add_options(recce_cloud_auth_options)
@add_options(recce_hidden_options)
def mcp_server(state_file, sse, host, port, **kwargs):
    """
    Start the Recce MCP (Model Context Protocol) server

    The MCP server provides an interface for AI assistants and tools to interact
    with Recce's data validation capabilities. By default, it uses stdio for
    communication. Use --sse to enable HTTP/Server-Sent Events mode instead.

    STATE_FILE is the path to the recce state file (optional).

    \b
    Prerequisites:
        Development dbt artifacts (target/) must exist before starting.
        Base artifacts (target-base/) are recommended for full diffing.
        - Development: dbt docs generate            (creates target/)
        - Base: dbt docs generate --target-path target-base
                                                     (creates target-base/)
        Without base artifacts, the server starts in single-environment
        mode where diff tools compare the current environment against
        itself (no changes expected).

    \b
    Available tools:
        The MCP server provides tools for lineage exploration, schema
        inspection, data diffing, and check management. The available
        tools depend on the server mode (server vs preview/read-only).
        See full list: https://docs.reccehq.com/setup-guides/mcp-server/#available-tools

    Examples:\n

    \b
    # Start the MCP server in stdio mode (default)
    recce mcp-server

    \b
    # Start with a state file
    recce mcp-server recce_state.json

    \b
    # Start in HTTP/SSE mode on default port 8000
    recce mcp-server --sse

    \b
    # Start in HTTP/SSE mode with custom host and port
    recce mcp-server --sse --host 0.0.0.0 --port 9000

    SSE Connection URL (when using --sse): http://<host>:<port>/sse
    """
    import asyncio

    from rich.console import Console

    from recce.config import RecceConfig
    from recce.exceptions import RecceConfigException
    from recce.util.api_token import prepare_api_token, show_invalid_api_token_message

    # In stdio mode, stdout is the JSON-RPC transport — all human-readable
    # output must go to stderr to avoid MCP client parse errors.
    console = Console(stderr=True) if not sse else Console()
    try:
        # Import here to avoid import errors if mcp is not installed
        from recce.mcp_server import run_mcp_server
    except ImportError as e:
        console.print(f"[[red]Error[/red]] Failed to import MCP server: {e}")
        console.print(r"Please install the MCP package: pip install 'recce\[mcp]'")
        exit(1)

    # Initialize Recce Config
    RecceConfig(config_file=kwargs.get("config"))

    handle_debug_flag(**kwargs)
    patch_derived_args(kwargs)

    # Prepare API token
    try:
        api_token = prepare_api_token(**kwargs)
        kwargs["api_token"] = api_token
    except RecceConfigException:
        show_invalid_api_token_message()
        exit(1)

    # Create state loader using shared function (for cloud mode or when state_file is provided)
    is_cloud = kwargs.get("cloud", False)
    if is_cloud or state_file:
        state_loader = create_state_loader_by_args(state_file, **kwargs)
        kwargs["state_loader"] = state_loader

    # Check Single Environment Onboarding Mode
    # When target-base/ doesn't exist, fall back to single-env mode:
    # set target_base_path = target_path so both envs load the same artifacts,
    # making all diffs show no changes. The MCP server adds _warning to responses.
    if not is_cloud:
        project_dir_path = Path(kwargs.get("project_dir") or "./")
        target_base_path = project_dir_path.joinpath(Path(kwargs.get("target_base_path", "target-base")))
        if not target_base_path.is_dir():
            kwargs["single_env"] = True
            kwargs["target_base_path"] = kwargs.get("target_path")
            console.print(
                "[yellow]Base artifacts not found. "
                "Starting in single-environment mode (diffs will show no changes).[/yellow]"
            )
            console.print("To enable diffing: dbt docs generate --target-path target-base")

    try:
        if sse:
            console.print(f"Starting Recce MCP Server in HTTP/SSE mode on {host}:{port}...")
            console.print(f"SSE endpoint: http://{host}:{port}/sse")
        else:
            console.print("Starting Recce MCP Server in stdio mode...")

        # Run the server (stdio or SSE based on --sse flag)
        asyncio.run(run_mcp_server(sse=sse, host=host, port=port, **kwargs))
    except (asyncio.CancelledError, KeyboardInterrupt):
        # Graceful shutdown (e.g., Ctrl+C)
        console.print("[yellow]MCP Server interrupted[/yellow]")
        exit(0)
    except Exception as e:
        console.print(f"[[red]Error[/red]] Failed to start MCP server: {e}")
        if kwargs.get("debug"):
            import traceback

            traceback.print_exc()
        exit(1)


@cli.group("cache", short_help="Manage column-level lineage cache.")
def cache():
    """Manage column-level lineage cache."""
    pass


@cache.command(cls=TrackCommand)
@click.option(
    "--cache-db",
    help="Path to the column-level lineage cache database.",
    type=click.Path(),
    default=None,
    show_default=False,
)
def stats(cache_db):
    """Show column-level lineage cache statistics."""
    from rich.console import Console

    from recce.util.cll import _DEFAULT_DB_PATH, CllCache

    console = Console()

    if cache_db is None:
        cache_db = _DEFAULT_DB_PATH

    if not os.path.exists(cache_db):
        console.print(f"Cache database not found: {cache_db}")
        console.print("0 entries")
        return

    c = CllCache(db_path=cache_db)
    s = c.stats
    file_size = os.path.getsize(cache_db)
    console.print(f"Cache: {cache_db}")
    console.print(f"{s['entries']} entries, {file_size / 1024:.1f} KB")


@cache.command(name="clear", cls=TrackCommand)
@click.option(
    "--cache-db",
    help="Path to the column-level lineage cache database.",
    type=click.Path(),
    default=None,
    show_default=False,
)
def clear_cache(cache_db):
    """Delete the column-level lineage cache database file."""
    from rich.console import Console

    from recce.util.cll import _DEFAULT_DB_PATH

    console = Console()

    if cache_db is None:
        cache_db = _DEFAULT_DB_PATH

    if not os.path.exists(cache_db):
        console.print(f"No cache file found at {cache_db}")
        return

    try:
        os.remove(cache_db)
    except FileNotFoundError:
        console.print(f"Cache file was already removed: {cache_db}")
        return
    except PermissionError:
        console.print(f"[[red]Error[/red]] Permission denied: cannot delete {cache_db}")
        exit(1)
    except OSError as e:
        console.print(f"[[red]Error[/red]] Failed to delete cache: {e}")
        exit(1)
    console.print(f"Deleted cache: {cache_db}")

    # Clean up SQLite WAL/SHM sidecar files
    for suffix in ("-wal", "-shm"):
        sidecar = cache_db + suffix
        if os.path.exists(sidecar):
            try:
                os.remove(sidecar)
            except OSError:
                pass


if __name__ == "__main__":
    cli()
