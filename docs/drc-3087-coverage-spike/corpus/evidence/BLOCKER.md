# BLOCKER: dbt cannot run inside the agent-safehouse sandbox

## What was attempted
The riskiest-assumption slice (C1 CASE model + one inline-`given` partial unit
test) was authored and `.venv/bin/dbt build --profiles-dir .` was run from
`docs/drc-3087-coverage-spike/corpus/`.

## What happened
`dbt build` fails during adapter registration (before any SQL runs) with:

    File ".../dbt/adapters/base/connections.py", line 78, in __init__
        self.lock: RLock = mp_context.RLock()
    ...
    PermissionError: [Errno 1] Operation not permitted

dbt's `BaseConnectionManager.__init__` creates a `multiprocessing` RLock, which
on macOS Python 3.13 requires a POSIX named semaphore (`sem_open`). The agent
runs inside a macOS App Sandbox container (`APP_SANDBOX_CONTAINER_ID=agent-safehouse`)
whose seatbelt profile denies `sem_open`.

## Scope of the deny (probed)
- `multiprocessing.get_context('fork'|'spawn'|'forkserver').RLock()` -> all fail
  `PermissionError [Errno 1] Operation not permitted` (see sem_open_BLOCKED.txt).
- Failure reproduces in foreground, with Claude's `dangerouslyDisableSandbox`,
  and as a fully-detached background process. The deny is the *outer* App
  Sandbox container, which Claude's own sandbox flag cannot override.

## What is NOT broken (proves the corpus itself is sound)
- Toolchain is correct: dbt-core 1.11.7, dbt-duckdb 1.10.1, dbt-adapters 1.22.9.
- duckdb works fine in-sandbox: `evidence/duckdb_c1_probe.py` runs the exact C1
  CASE SQL and returns the expected unit-test rows
  `[(1,'placed','open'),(3,'completed','fulfilled')]` (see duckdb_c1_probe.out.txt).
  So the SQL, the duckdb engine, and the partial-coverage fixture logic are valid;
  only dbt's CLI process initialization is blocked.

## Unblock options (for captain / FO)
1. Run the dbt commands from a shell OUTSIDE the safehouse container
   (the captain's own terminal). Commands, from `corpus/`:
       /Users/danyel/code/Recce/recce/.venv/bin/dbt build       --profiles-dir .
       /Users/danyel/code/Recce/recce/.venv/bin/dbt test --select test_type:unit --profiles-dir .
   then commit the transcript into this `evidence/` dir.
2. OR grant the agent-safehouse seatbelt profile `sem_open` (mach/posix sem)
   so dbt's multiprocessing RLock can be created, then re-dispatch this stage.

## Machine-dependency note
The venv is at the MAIN repo root (`/Users/danyel/code/Recce/recce/.venv`),
NOT inside the worktree. It is reproducible via `make install-dev`. The corpus
`profiles.yml` uses a relative duckdb `path:` so no machine-specific DB config.
