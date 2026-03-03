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
| Import errors | Missing or wrong package | `pip install -e .[dev]` |
| Adapter not found | Wrong CLI flags | Check `--sqlmesh` flag |
| State not persisting | FileStateLoader path | Check `recce_state.json` location |
| SQL execution fails | Adapter connection | Run `recce debug` |

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
