<p align="center">
    <a href="https://datarecce.io" target="_blank">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.png">
            <source media="(prefers-color-scheme: light)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.png">
            <img alt="Recce: DataRecce.io" src="https://datarecce.io/assets/images/recce-logo-stacked.png" width="200" style="width: 100%; max-width: 200px; display: block; margin: 0 auto 20px;">
        </picture>
    </a>
</p>

<h3 align="center">The&nbsp;data&nbsp;validation&nbsp;toolkit<br />for teams that care about building better data</h3>

<p align="center">
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/badge/pip_install-recce-006DAD?style=flat-square" alt="install"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/pypi/v/recce?style=flat-square" alt="pipy"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/pypi/pyversions/recce?style=flat-square" alt="Python"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/#files"><img src="https://img.shields.io/pypi/dw/recce?style=flat-square" alt="downloads"></a> &nbsp; 
    <a href="https://github.com/DataRecce/recce/blob/main/LICENSE"><img src="https://img.shields.io/github/license/DataRecce/recce?style=flat-square" alt="license"></a> &nbsp; 
    <a href="https://getdbt.slack.com/archives/C05C28V7CPP"><img src="https://img.shields.io/badge/Slack-4A154B?style=flat-square&amp;logo=slack&amp;logoColor=white" alt="Slack"></a> &nbsp; 
    <a href="https://discord.com/invite/5zb2aK9KBV"><img src="https://img.shields.io/discord/664381609771925514?color=%237289DA&amp;label=chat&amp;logo=discord&amp;logoColor=white&amp;style=flat-square" alt="InfuseAI Discord Invite"></a> &nbsp; 
</p>

## Introduction

`Recce` is a toolkit for performing data validation in the context of data modeling and pull request (PR) review for dbt projects.

Data validations, or 'checks', are a method of impact assessment performed by comparing the data in two dbt environments, such as development and production schemas. `Recce` enables the identifying and investigating of data change throughout the pull request process, from data modeling to stakeholder approval. 

<a href="https://datarecce.io"><img src="https://datarecce.io/assets/images/landing/home/featured_image.png" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 20px;" /></a>

## Who's using `Recce`?

`Recce` is useful for validating your own work or the work of others, and can also be used to share data impact with non-technical stakeholders to approve data checks.

- **Data engineers** can use `Recce` to ensure the structural integrity of the data and understand the scope of impact before merging.

- **Analysts** can use `Recce` to self-review and understand how data modeling changes have changed the data.

- **Stakeholders** can use `Recce` to sign-off on data after updates have been made


## Why `Recce`

[dbt](https://www.getdbt.com/) has brought many software best practices to data projects, such as:

- Version controlled code
- Modular SQL
- Reproducible pipelines 

Even so, 'bad merges' still happen, in which updated data models are merged into production without proper checks; resulting in erroneous data, silent errors, or even data downtime. This is due to the unique situation encountered by reviewers of having to review both the code (data models) and the resultant data.

In addition, the dbt culture of 'self-serve analytics' has opened up data pipelines to the wider data team. This means that many roles, all with differing priorities, are modifying the dbt pipeline and making the job of reviewing pull requests even more difficult. Impact assessment and data QA is also made difficult by the growing size and complexity of dbt projects.

The best way to understand the impact of code changes on data is to compare the data before-and-after the changes. To ensure:

- historical data is not impacted (does not change) and
- intentional modifications have the desired impact.

This is where `Recce` comes in, by providing a self-serve review environment for the self-serve data platform specifically geared towards surfacing and understanding data impact from code changes.

## Features

The core concept of `Recce` is comparing data between your pull request and a known-good base, such as production, or ideally a staging environment. Therefore, to suite of tools, or *diffs*, in `Recce` are designed to help you find and record this change.

### Lineage Diff
[Lineage Diff](https://datarecce.io/docs/features/lineage/) is the main interface to `Recce` is the Lineage Diff chart. It shows which nodes in the lineage have been added, removed, or modified.

### Structural Diffs
See if columns have been added or removed, and perform row count diffs for selected models to see if data has been lost.

- [Schema Diff](https://datarecce.io/docs/features/lineage/#schema-diff) - Show the struture of the table including added or removed columns
- [Row Count Diff](https://datarecce.io/docs/features/lineage/#row-count-diff) - Compares the row count for tables

### Advanced Diffs

Advanced Diffs provide high level statistics about data change:

- [Profile Diff](https://datarecce.io/docs/features/lineage/#profile-diff): Compares stats such as count, distinct count, min, max, average.
- [Value Diff](https://datarecce.io/docs/features/lineage/#value-diff): The matched count and percentage for each column in the table.
- [Top-K Diff](https://datarecce.io/docs/features/lineage/#top-k-diff): Compares the distribution of a categorical column.
- [Histogram Diff](https://datarecce.io/docs/features/lineage/#histogram-diff): Compares the distribution of a numeric column in an overlay histogram chart.

### Query Diff
[Query Diff](https://datarecce.io/docs/features/query/) compares the results of any ad-hoc query, and supports the use of dbt macros.


### Checklist
The [checklist](https://datarecce.io/docs/features/checklist/) provides a way to record the results of your data validation process.

- Save the results of checks
- Re-run checks
- Annotate checks to add context
- Share the results of checks
- (`Recce Cloud`) Sync checks and check results across Recce instances
- (`Recce Cloud`) Block PR merging until checks have been approved

## `Recce` Use cases

Recce is designed for reviewing data change, which can happen at many stages of the PR process:

### Development

Start a Recce server locally, during development, to inspect and investigate how your data modeling changes are impacting the data in your development schema compared to prod.

After performing data checks and create a checklist:

- Copy the results of your development-time data validations into the PR comment to show that you have done your due diligence and performed QA on your work.
- [Share the Recce state file](https://datarecce.io/docs/guides/scenario-pr-review/#share-the-recce-file) by exporting and attaching it to your PR comment.

### PR Review

The PR reviewer can:
- review the checks manually added by the PR author
- download the [Recce state file](https://datarecce.io/docs/features/state-file/) that has been attached to the PR by either CI automation, or the PR author.

After downloading the state file, Recce can be run in [Review Mode](https://datarecce.io/docs/guides/scenario-pr-review/#share-the-recce-file), which does not require the dbt project to be present.

### Continuous Integration (CI)
Get full coverage of your pipeline by setting up [preset checks](https://datarecce.io/docs/features/preset-checks/) that run on all 
 `Recce Cloud` users can take advantage of our GitHub app that will enable the blocking of merging and alerting to unapproved checks. 

#### Automated Impact Summary
`Recce` can output an [Impact Summmary](https://datarecce.io/docs/features/recce-summary/) which can be posted as a PR comment as part of your CI automation. If data change from any of your checks is detected then the `Recce` Summary will show which ones. Run `Recce` in review mode to investigate the impact. 

### Other uses

`Recce` is also useful for troubleshooting root causes by using Query Diff to compare ad-hoc queries and comparing data at the row level.


## Demo

We provide three online demo instances of Recce, each with a related pull request. Use these demo instances to inspect the impact of the data modeling changes on the project lineage and data.

For each demo, review the following:

- The pull request comment
- The code changes
- How the lineage and data has changed in `Recce`

This will enable you to validate if the intention of the PR has been successfully implemented and no unintended impact has occurred. 

> [!TIP]
> Don't forget to click the `Checks` tab to view the  data validation checklist, or perform your own checks for further investigation.

### Demo 1: Calculation logic change

This pull request adjusts the **logic** for how customer lifetime value is calculated:

- [Demo #1](https://pr1.cloud.datarecce.io)
- [Pull request #1](https://github.com/DataRecce/jaffle_shop_duckdb/pull/1)

### Demo 2: Refactoring

This pull request performs some **refactoring** on the customers model by turning two CTEs into intermediate models, enhancing readability and maintainability:

- [Demo #2](https://pr2.cloud.datarecce.io)
- [Pull request #2](https://github.com/DataRecce/jaffle_shop_duckdb/pull/2)

### Demo 3: Analysis

This pull request introduces a new Rounding Effect **Analysis** feature, aimed at analyzing and reporting the impacts of rounding in our data processing.

- [Demo #3](https://pr3.cloud.datarecce.io)
- [Pull request #3](https://github.com/DataRecce/jaffle_shop_duckdb/pull/3)


## How to use `Recce`
The following is a basic example of installing and using `Recce`. For a full introduction to using `Recce` please visit the [documentation](https://datarecce.io/docs/get-started/). 

`Recce` requires at least two output schemas in your dbt `profiles.yml`, for example:

```yaml
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

Install Recce with Pip:
 
 ```bash
 pip install recce
 ```

Generate the dbt artifacts for your `base` environment. This is the stable environment that your PR data will be compared against.

```bash
git checkout main

dbt run --target prod
dbt docs generate --target prod --target-path target-base/
```

> [!NOTE]  
> You must build these artifacts into a directory named `target-base`

Generate the artifacts for your `target` (PR) environment: 

```
git checkout feature/my-awesome-feature

dbt run
dbt docs generate
```

Start the `Recce` server:

```
recce server
```

This will launch 

## Data Security
`Recce` consists of a local server application that you run on your own device or compute services. 

- Diffs or queries that are performed by `Recce` happen either in your data warehouse, or in the browser itself.
- `Recce` does not store or transmit your data.

For `Recce Cloud` users:
- An encrypted version of your `Recce` [state file](https://datarecce.io/docs/features/state-file/) is storedon `Recce Cloud`. This file is encrypted *before* transmission.  

## Recce Cloud

`Recce Cloud` provides a backbone of supporting services that make Recce usage more suitable for teams reviewing multiple pull requests.

With `Recce Cloud`:

- `Recce` environments can be instantiated **directly from a PR**
- **data checks** are automatically **synced** across `Recce` instances
- **unapproved checks can block merging** of pull requests

[Recce Cloud](https://datarecce.io/cloud) is currently in early-access private beta. 

To find out how you can get access please [book an appointment](https://cal.com/team/recce/chat) for a short meeting.


## Documentation 

The [Recce Documentation](https://datarecce.io/docs/) covers everything you need to get started from a 5-minute tutorial using Jaffle Shop, to advice on best practices for your dbt environments.


## Community &amp; Support

Here's where you can get in touch with the `Recce` team and find support:

- [dbt Slack](https://www.getdbt.com/community/join-the-community) in the [#tools-recce](https://getdbt.slack.com/archives/C05C28V7CPP) channel
- [Recce Discord](https://discord.gg/VpwXRC34jz)
- Email us [product@datarecce.io](mailto:product@datarecce.io)

If you believe you have found a bug, or there is some missing functionality in Recce, please open a [GitHub Issue](https://github.com/DataRecce/recce/issues).

## Recce on the web

You can follow along with news about `Recce` and blogs from our team in the following places:

- [LinkedIn](https://www.linkedin.com/company/datarecce)
- [Medium blog](https://medium.com/inthepipeline)
- [@datarecce](https://x.com/DataRecce) on X
- [@DataRecce@mastodon.social](https://mastodon.social/@DataRecce) on Mastodon
- [@datarecce.bsky.social](https://bsky.app/profile/datarecce.bsky.social) on BlueSky
