<p align="center">
    <a href="https://datarecce.io">
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

<p align="center">
    <a href="https://cal.com/team/recce/chat?utm_source=banner&utm_campaign=oss">
        <img alt="Book us with Cal.com" src="https://cal.com/book-with-cal-light.svg" />
    </a>
</p>

## Introduction

`Recce` is data validation toolkit for pull request (PR) review in dbt projects. Get enhanced visibility into how your
team’s dbt modeling changes impact data by comparing your dev branch with stable production data. Run manual data checks
during development, and automate checks in CI for PR review.

## Quick Start

You can launch Recce in any dbt project in just two commands:

```Bash
# cd into your dbt project
pip install -U recce
recce server
```

To use the full suite of diffing tools in Recce, please prepare two environments to compare against. Follow
our [5-minute Jaffle Shop tutorial](https://datarecce.io/docs/get-started-jaffle-shop/) to try it out for yourself.

## What you get

`recce server` launches a web UI that shows you the area of your lineage that is impacted by the branch changes.

<a href="https://datarecce.io"><img src="https://datarecce.io/assets/images/readme/recce-overview-screenshot.png" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 20px;" /></a>

### Using Recce for Impact Assessment in dbt PR Review

- Select nodes in the lineage to perform Checks (diffs) as part of your impact assessment during development or PR
  review.
- Add Checks to your Checklist to note observed impacts.
- Share your Checklist with the PR reviewer.
- (`Recce Cloud`) Automatically sync Check status between Recce Instances
- (`Recce Cloud`) Block PR merging until all Recce Checks have been approved

Read more about using [Recce for Impact Assessment](https://datarecce.io/blog/hands-on-data-impact-analysis-recce/) on
the Recce blog.

## Try the Online Demo

We provide three online Recce demos (based on Jaffle Shop), each is related to a specific pull request. Use these demos
to inspect the data impact caused by the modeling changes in the PR.

For each demo, review the following:

- The pull request comment
- The code changes
- How the lineage and data has changed in `Recce`

This will enable you to validate if the intention of the PR has been successfully implemented without unintended impact.

> [!TIP]
> Don't forget to click the Checks tab to view the Recce Checklist, and perform your own Checks for further
> investigation.
>

### Demo 1: Calculation logic change

This pull request adjusts the **logic** for how customer lifetime value is calculated:

- [Demo #1](https://pr1.demo.datarecce.io/)
- [Pull request #1](https://github.com/DataRecce/jaffle_shop_duckdb/pull/1)

### Demo 2: Refactoring

This pull request performs some **refactoring** on the customers model by turning two CTEs into intermediate models,
enhancing readability and maintainability:

- [Demo #2](https://pr2.demo.datarecce.io/)
- [Pull request #2](https://github.com/DataRecce/jaffle_shop_duckdb/pull/2)

### Demo 3: Analysis

This pull request introduces a new Rounding Effect **Analysis** feature, aimed at analyzing and reporting the impacts of
rounding in our data processing.

- [Demo #3](https://pr3.demo.datarecce.io/)
- [Pull request #3](https://github.com/DataRecce/jaffle_shop_duckdb/pull/3)

### Demo 4: Enhancing the existing model

This pull request **enhances** the existing `customers` model by categorizing whether a customer has placed an order as
part of a promotion.

- [Demo #4](https://pr44.demo.datarecce.io/)
- [Pull request #44](https://github.com/DataRecce/jaffle_shop_duckdb/pull/44)

## Why `Recce`

[dbt](https://www.getdbt.com/) has brought many software best practices to data projects, such as:

- Version controlled code
- Modular SQL
- Reproducible pipelines

Even so, 'bad merges' still happen and erroneous data and silent errors make their way into prod data. As self-serve
analytics opens dbt projects to many roles, and the size of dbt projects increase, the job of reviewing data modeling
changes is even more critical.

The only way to understand the impact of code changes on data is to compare the data before-and-after the changes.

## Features

`Recce` provides a data review environment for data teams to check their work during development, and then again as part
of PR review. The suite of tools and diffs in Recce are specifically geared towards surfacing, understanding, and
recording data impact from code changes.

### Lineage Diff

[Lineage Diff](https://datarecce.io/docs/features/lineage/) is the main interface to `Recce`  and shows which nodes in
the lineage have been added, removed, or modified.

### Structural Diffs

- [Schema Diff](https://datarecce.io/docs/features/lineage/#schema-diff) - Show the struture of the table including
  added or removed columns
- [Row Count Diff](https://datarecce.io/docs/features/lineage/#row-count-diff) - Compares the row count for tables

### Statistical Diffs

Advanced Diffs provide high level statistics about data change:

- [Profile Diff](https://datarecce.io/docs/features/lineage/#profile-diff): Compares stats such as count, distinct
  count, min, max, average.
- [Value Diff](https://datarecce.io/docs/features/lineage/#value-diff): The matched count and percentage for each column
  in the table.
- [Top-K Diff](https://datarecce.io/docs/features/lineage/#top-k-diff): Compares the distribution of a categorical
  column.
- [Histogram Diff](https://datarecce.io/docs/features/lineage/#histogram-diff): Compares the distribution of a numeric
  column in an overlay histogram chart.

### Query Diff

[Query Diff](https://datarecce.io/docs/features/query/) compares the results of any ad-hoc query, and supports the use
of dbt macros.

### Checklist

The [checklist](https://datarecce.io/docs/features/checklist/) provides a way to record the results of your data
validation process.

- Save the results of checks
- Re-run checks
- Annotate checks to add context
- Share the results of checks
- (`Recce Cloud`) Sync checks and check results across Recce instances
- (`Recce Cloud`) Block PR merging until checks have been approved

## Who's using `Recce`?

`Recce` is useful for validating your own work or the work of others, and can also be used to share data impact with
non-technical stakeholders to approve data checks.

- **Data engineers** can use `Recce` to ensure the structural integrity of the data and understand the scope of impact
  before merging.
- **Analysts** can use `Recce` to self-review and understand how data modeling changes have changed the data.
- **Stakeholders** can use `Recce` to sign-off on data after updates have been made

## Documentation / How to use `Recce`

The [Recce Documentation](https://datarecce.io/docs/) covers everything you need to get started.

We’d advise first following the [5-minute tutorial](https://datarecce.io/docs/get-started-jaffle-shop/) that uses Jaffle
Shop and then [trying out Recce](https://datarecce.io/docs/get-started/) in your own project.

For advice on best practices in preparing dbt environments to enable effective PR review, check
out [Best Practices for Preparing Environments](https://datarecce.io/docs/guides/best-practices-prep-env/).

## Recce Cloud

`Recce Cloud` provides a backbone of supporting services that make Recce usage more suitable for teams reviewing
multiple pull requests.

With `Recce Cloud`:

- `Recce` Instances can be launched **directly from a PR**
- **Checks** are automatically **synced** across `Recce` Instances
- **Blocked merging** until all checks are approved

[Recce Cloud](https://datarecce.io/cloud) is currently in early-access private beta.

To find out how you can get access
please [book an appointment](https://cal.com/team/recce/chat?utm_source=banner&utm_campaign=oss) for a short meeting.

<a href="https://cal.com/team/recce/chat?utm_source=banner&utm_campaign=oss">
<img alt="Book us with [Cal.com](http://cal.com/)" src="https://cal.com/book-with-cal-light.svg" />
</a>

## Data Security

`Recce` consists of a local server application that you run on your own device or compute services.

- Diffs or queries that are performed by `Recce` happen either in your data warehouse, or in the browser itself.
- `Recce` does not store your data.

For `Recce Cloud` users:

- An encrypted version of your `Recce` [state file](https://datarecce.io/docs/features/state-file/) is storedon
  `Recce Cloud`. This file is encrypted *before* transmission.

## Community & Support

Here's where you can get in touch with the `Recce` team and find support:

- [dbt Slack](https://www.getdbt.com/community/join-the-community) in
  the [#tools-recce](https://getdbt.slack.com/archives/C05C28V7CPP) channel
- [Recce Discord](https://discord.gg/VpwXRC34jz)
- Email us [product@datarecce.io](mailto:product@datarecce.io)

If you believe you have found a bug, or there is some missing functionality in Recce, please open
a [GitHub Issue](https://github.com/DataRecce/recce/issues).

## Recce on the web

You can follow along with news about `Recce` and blogs from our team in the following places:

- [DataRecce.io](https://DataRecce.io)
- [LinkedIn](https://www.linkedin.com/company/datarecce)
- [Medium blog](https://medium.com/inthepipeline)
- [@datarecce](https://x.com/DataRecce) on Twitter/X
- [@DataRecce@mastodon.social](https://mastodon.social/@DataRecce) on Mastodon
- [@datarecce.bsky.social](https://bsky.app/profile/datarecce.bsky.social) on BlueSky
