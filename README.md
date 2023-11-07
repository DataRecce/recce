# piti

`piti` is an environment diff tool for dbt

# Getting Started

1. Installation

   ```
   git clone git@github.com:InfuseAI/piti.git
   cd piti
   pip install -e .
   ```

2. You should have at least two [environments](https://docs.getdbt.com/docs/core/dbt-core-environments) in your project. For example, one is for developing and another is for production. The data is stored in different [schemas](https://docs.getdbt.com/docs/core/connect-data-platform/connection-profiles#understanding-target-schemas) in the data warehouse.

   Here is an example of `profiles.yml`

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

3. Put the `manifest.json` of proudction (or environment to diff) in the `target-base/` folder.

4. Develop your awesome features

   ```
   dbt run
   ```

5. Run the piti commands
   ```
   piti server
   ```

# Usage

## Diff in Web GUI

Run a piti server locally

```
piti server
```

## Diff in CLI

1. Diff a model. It shows the schema or row count change.
   ```
   piti diff orders
   ```
1. Diff a resource with other methods. Preview is to query the top 100 rows in the table
   ```
   piti diff orders preview
   ```
1. Diff with adhoc query

   ```
   piti diff --sql 'select date_week, sum(amounts) as revenue from {{ ref("orders") }} group by 1'
   ```

# Q&A

### Q: How `piti` connect to my data warehouse? Does piti support my data warehouse?

`piti` use the [dbt adapter](https://docs.getdbt.com/docs/connect-adapters) to connect to your warehouse. So it should work for your data warehouse.

### Q: What credential does `piti` connect to the two schemas?

It uses the same target. If you use the default target `dev`, it use the credentials to connect to both schemas. So the credential should have the permission to both schemas.
