## Adapter Macros

Recce use dbt package `audit-hepler` and `dbt_profiler` for value diff and profile diff. However, it encounters some SQL compatibility issues in some warehouse. The folder is to provide adapter-specific macro by mean of the dbt [macro dispatch](https://docs.getdbt.com/reference/dbt-jinja-functions/dispatch) mechanism.

## How to use

1. Copy `recce_<adapter>.sql` to your dbt project `macros/` folder.
2. Rerun any `dbt` command (e.g. `dbt run`) to make macros available in the `target/manifest.json`
