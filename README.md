# recce

`recce` is a environment diff tool for dbt

## Features

1. Support the same dbt adapter framework as dbt.
2. Support both Web UI & CLI
3. Lineage diff

## Use cases

1. When developing, we can check the new result by comparing against the production one.
2. When reviewing PR, you can understand the change impacts.
3. When trouble shooting, you can run adhoc dif query to find the root causes.

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

1. Installation

   ```
   git clone git@github.com:InfuseAI/recce.git
   cd recce
   pip install -e .
   ```

1. Put the `manifest.json` of production (or any environment you would like to diff) in the `target-base/` folder. `manifest.json` is one of the generated artifacts for each dbt command execution. You can find it in `target/` folder by default.

1. Develop your awesome features

   ```
   dbt run
   ```

1. Run the recce command

   ```
   recce server
   ```

1. Review the linage diff.
1. Switch to query tab, Write and run a query

   ```sql
   select * from {{ ref('mymodel') }}
   ```

   where `ref` is a Jinja macro to reference a model name.

> Under the hood, recce uses the `manifest.json` under `target/` and `target-base/` to geenrate query and execute.

## Run Query Diff

You can either run in Web UI

```
recce server
```

or run in CLI

```
recce diff --sql 'select * from {{ ref('mymodel') }}'
```

## Specify the primary key columns

In the query diff, we use primary key columns as the basis for identifying the same record on both sides.

There are two ways to specify the primary key

1. **Define in the SQL:** Add the `config` macro in your sql.

   ```
   {{
      config( primary_key=['DATE_WEEK', 'COUNTRY'])
   }}

   select ...
   ```

1. **Select in the query result:** In the Web UI, you can click the key icons in the column headers to toggle if a column is a primary key.

# Q&A

### Q: How `recce` connect to my data warehouse? Does recce support my data warehouse?

`recce` use the [dbt adapter](https://docs.getdbt.com/docs/connect-adapters) to connect to your warehouse. So it should work for your data warehouse.

### Q: What credential does `recce` connect to the two environments?

Recce uses the same target in the profile to connect your warehouse. If you use the default target `dev`, it use the credentials to connect to both environments. So please make sure that the credential able to access both environments.
