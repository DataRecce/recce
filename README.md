# Recce
[![install](https://img.shields.io/badge/pip_install-recce-006DAD?style=flat-square)](https://pypi.org/project/recce/)
[![pipy](https://img.shields.io/pypi/v/recce?style=flat-square)](https://pypi.org/project/recce/)
[![Python](https://img.shields.io/pypi/pyversions/recce?style=flat-square)](https://pypi.org/project/recce/)
[![downloads](https://img.shields.io/pypi/dw/recce?style=flat-square)](https://pypi.org/project/recce/#files)
[![license](https://img.shields.io/github/license/DataRecce/recce?style=flat-square)](https://github.com/DataRecce/recce/blob/main/LICENSE)

[![InfuseAI Discord Invite](https://img.shields.io/discord/664381609771925514?color=%237289DA&label=chat&logo=discord&logoColor=white&style=flat-square)](https://discord.com/invite/5zb2aK9KBV)

`recce` is an environment diff tool for DBT projects. It helps you to compare the results of two environments, such as development and production, and identify the differences.

## Features

1. Support both Web UI & CLI
1. Multiple diff tools, including lineage diff, schema diff, and query diff. And more in the future.
1. Use the dbt-core adapter framework to connect to your data warehouse. No additional configuration is required.

## Use cases

1. During development, we can verify new results by contrasting them with those from production prior to pushing the changes.
2. While reviewing PR, you can grasp the extent of the changes and their impact before merging.
3. For troubleshooting, you can execute ad-hoc diff queries to pinpoint the root causes.

# Usage

## Prerequisites

You have to have at least two [environments](https://docs.getdbt.com/docs/core/dbt-core-environments) in your dbt project. For example, one is for development and another is for production. You can prepare two targets with separate [schemas](https://docs.getdbt.com/docs/core/connect-data-platform/connection-profiles#understanding-target-schemas) in your DBT profile. Here is `profiles.yml` example

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

1. Go to your DBT project
   ```
   cd your-dbt-project/
   ```
1. **Prepare base artifacts**: DBT generates [artifacts](https://docs.getdbt.com/reference/artifacts/dbt-artifacts) when every invocation. You can find these files in the `target/` folder.

   | artifacts               | DBT command                |
   | ----------------------- | -------------------------- |
   | manifest.json           | `dbt run`, `dbt build`, .. |
   | catalog.json (optional) | `dbt docs generate`        |

   Copy the artifacts for the base environment to `target-base/` folder.

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

- **CLI**: Use the option `--primary-keys` to specify the primary keys. Use a comma to separate the columns if it is a compound key.

  ```shell
  recce diff --primary-keys event_id --sql 'select * from {{ ref("events") }} order by 1'
  ```

# Q&A

### Q: How `recce` connect to my data warehouse? Does recce support my data warehouse?

`recce` use the [dbt adapter](https://docs.getdbt.com/docs/connect-adapters) to connect to your warehouse. So it should work for your data warehouse.

### Q: What credential does `recce` connect to the two environments?

Recce uses the same target in the profile to connect your warehouse. If you use the default target `dev`, it uses the credentials to connect to both environments. So please make sure that the credential can access both environments.
