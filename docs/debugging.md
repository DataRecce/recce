# Debugging

## Backend Debugging

### Verbose Logging

```bash
recce server --debug
```

Logs to console and `recce_error.log`.

### Artifact/Connection Issues

```bash
recce debug
```

Checks dbt artifacts and database connections.

### Common Backend Issues

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Import errors | Missing or wrong package | `make install-dev` (uses uv) |
| Adapter not found | Wrong CLI flags | Check `--sqlmesh` flag |
| State not persisting | FileStateLoader path | Check `recce_state.json` location |
| SQL execution fails | Adapter connection | Run `recce debug` |
| `recce github artifact` refuses to extract (exits 1) | Unsupported archive content/layout, exceeded resource limits, or an HTTP/filesystem failure | Fix the workflow artifact using the policy below, or retry a failed download. Existing project files are never extraction destinations. |

### GitHub workflow artifact downloads

The hidden `recce github artifact` command keeps the current selection behavior: it
uses the first successful `pull_request` workflow run returned for the current
branch, then downloads every artifact in that run without filtering artifact names.
It requires a Git worktree. Invoking it from a nested directory still anchors output
to the Git worktree root.

Each ZIP must contain at least one of these exact lowercase filenames:
`manifest.json`, `catalog.json`, `run_results.json`, `sources.json`,
`semantic_manifest.json`, or `recce_state.json`. Files must either all be at the
archive root or all directly below `target/`; an empty `target/` directory entry is
optional. Mixed layouts and other directories or filenames are rejected. This
includes `.git` in any case, Windows `git~1` aliases, dotfiles, YAML configuration,
and unexpected extensions. Existing traversal, symlink, special-file, duplicate
path, encryption, and CRC checks also apply.

Limits apply to each artifact: 128 MiB of downloaded ZIP bytes, 512 MiB of cumulative
uncompressed bytes, and 16 ZIP members (including directories). Exact limits are
accepted. Both declared sizes and actual decompressed bytes are checked. HTTP
requests stream with a 5-second connect timeout and a 30-second read timeout; the
read timeout measures inactivity rather than total transfer time.

Validation and CRC checks happen in a private system temporary directory. Only a
fully validated archive is published, with its files flattened into a fresh
`.recce-github-artifact-<unique>` subdirectory under the Git worktree root. The
command prints that absolute directory and its filenames for each artifact. It
does not replace the project's `target/`, configuration, Git metadata, or earlier
downloads. A failed archive leaves no partial output; successful earlier artifacts
remain if a later artifact fails. Temporary staging directories are cleaned up.
Remove published directories manually when finished. As with other local file
operations, concurrent mutation of the worktree by another local process is
outside these extraction checks.

Scripts that previously relied on files appearing in the current directory must
use the printed path explicitly. For example, after downloading, use one of:

```bash
recce github artifact
# Substitute the absolute directory printed by the command:
recce server --target-path /path/to/worktree/.recce-github-artifact-UNIQUE
# To use the download as the baseline instead:
recce server --target-base-path /path/to/worktree/.recce-github-artifact-UNIQUE
```

These server examples require a download containing the dbt files needed by your
project. To open a downloaded state file, pass its full path as the server's
`STATE_FILE` argument. Downloaded JSON remains untrusted; this command validates
archive paths and sizes, not JSON content, and does not automatically load it.

## Frontend Debugging

### Development Tools

- **React DevTools** - Component tree, state, props
- **Browser Console** - Errors, network requests
- **Network Tab** - API call inspection

### Common Frontend Issues

| Problem | Diagnosis | Fix |
|---------|-----------|-----|
| Changes not appearing | Stale build | `cd js && pnpm run build`, restart server |
| Type errors | TypeScript | `pnpm type:check` for details |
| Lint failures | Biome | `pnpm lint:fix` to auto-fix |
| Test failures | Vitest | Check test output, update snapshots if needed |

### Hot Reload Issues

If hot reload stops working:
```bash
# Kill dev server, clear cache
cd js
rm -rf .next
pnpm dev
```

## Full Stack Debugging

### API Communication

1. Check browser Network tab for failed requests
2. Verify backend is running: `curl http://localhost:8000/api/health`
3. Check CORS if frontend on different port

### State Sync Issues

1. Check `recce_state.json` for corrupted state
2. Delete state file and restart for fresh state
3. For cloud sync, check network connectivity

## Test Debugging

### Python Test Failures

```bash
# Verbose output
pytest tests -v

# Stop on first failure
pytest tests -x

# Run specific test
pytest tests/test_file.py::test_function -v
```

### Frontend Test Failures

```bash
cd js

# Verbose output
pnpm test -- --reporter=verbose

# Run specific test
pnpm test -- path/to/test.ts

# Update snapshots
pnpm test -- -u
```

### Integration Test Failures

Check dbt artifacts:
```bash
ls integration_tests/dbt/target
```

Regenerate if missing:
```bash
cd integration_tests/dbt
dbt build
```

## Performance Debugging

### Backend Profiling

```python
import cProfile
cProfile.run('your_function()')
```

### Frontend Profiling

- React DevTools Profiler
- Chrome Performance tab
- Lighthouse audits

## Log Locations

| Component | Log Location |
|-----------|--------------|
| Backend | Console, `recce_error.log` |
| Frontend Dev | Browser console |
| Tests | Test runner output |
