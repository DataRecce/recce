# recce

`recce` is a environment diff tool for dbt

## Features

1. Support both Web UI & CLI
1. Multiple diff tools, including lineage diff, schema diff, and query diff. And more in the future.
1. Use the dbt-core adapter framework to connect to your data warehouse. No additional configuration required.

## Use cases

1. During development, we can verify new results by contrasting them with those from production prior to pushing the changes.
2. While reviewing PR, you can grasp the extent of the changes and their impact before merge.
3. For troubleshooting, you can execute ad-hoc diff queries to pinpoint the root causes.

# Usage

## Prerequisites

You have to have at least two [environments](https://docs.getdbt.com/docs/core/dbt-core-environments) in your dbt project. For example, one is for developing and another is for production. You can prepare two targets with separate [schemas](https://docs.getdbt.com/docs/core/connect-data-platform/connection-profiles#understanding-target-schemas) in you dbt profile. Here is `profiles.yml` example

```
jaffle_shop:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: jaffle_shop.duckdb
      schema: dev
    prod:
      type: duckdb
      path: jaffle_shop.duckdb
      schema: main
```

## Getting Started

[5 minutes walkthrough by jaffle shop example](./docs/get-started-jaffle-shop.md)

1. Installation

   ```
   pip install recce
   ```

1. Go to your dbt project
   ```
   cd your-dbt-project/
   ```
1. **Prepare base artifacts**: DBT generates [artifacts](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) when every invocation. You can find these files in the `target/` folder.

   | artifacts               | dbt command                |
   | ----------------------- | -------------------------- |
   | manifest.json           | `dbt run`, `dbt build`, .. |
   | catalog.json (optional) | `dbt docs generate`        |

   Copy the artifacts for base environment to `target-base/`

1. Run the recce server.

   ```
   recce server
   ```

   Recce would diff environments between `target/` and `target-base/`

## Query Diff

You can run query diff in both Web UI and CLI

- **Web UI**: Go to **Query** tab

  ```jinja
  select * from {{ ref("mymodel") }}
  ```

- **CLI**:

  ```shell
  recce diff --sql 'select * from {{ ref("mymodel") }}'
  ```

### Primay key

In the query diff, primary key columns serve as the fundamental identifiers for distinguishing each record uniquely across both sides.

- **Web UI**: In the query result, click the _key_ icons in the column headers to toggle if it is in the primary key list.

- **CLI**: Use the option `--primary-keys` to specify the primary keys. Use comma to separate the columns if it is a compound key.

  ```shell
  recce diff --primary-keys event_id --sql 'select * from {{ ref("events") }} order by 1'
  ```

# Q&A

### Q: How `recce` connect to my data warehouse? Does recce support my data warehouse?

`recce` use the [dbt adapter](https://docs.getdbt.com/docs/connect-adapters) to connect to your warehouse. So it should work for your data warehouse.

### Q: What credential does `recce` connect to the two environments?

Recce uses the same target in the profile to connect your warehouse. If you use the default target `dev`, it use the credentials to connect to both environments. So please make sure that the credential able to access both environments.
