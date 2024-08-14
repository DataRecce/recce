<picture>
 <source media="(prefers-color-scheme: dark)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.png">
 <source media="(prefers-color-scheme: light)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.png">
 <img alt="Recce: DataRecce.io" src="https://datarecce.io/assets/images/recce-logo-stacked.png" style="width: 100%; max-width: 200px; display: block; margin: 0 auto 20px;">
</picture>

<h3 align="center">The data validation toolkit for teams that care about building better data</h3>

<p align="center">
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/badge/pip_install-recce-006DAD?style=flat-square" alt="install"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/pypi/v/recce?style=flat-square" alt="pipy"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/"><img src="https://img.shields.io/pypi/pyversions/recce?style=flat-square" alt="Python"></a> &nbsp; 
    <a href="https://pypi.org/project/recce/#files"><img src="https://img.shields.io/pypi/dw/recce?style=flat-square" alt="downloads"></a> &nbsp; 
    <a href="https://github.com/DataRecce/recce/blob/main/LICENSE"><img src="https://img.shields.io/github/license/DataRecce/recce?style=flat-square" alt="license"></a> &nbsp; 
    <a href="https://getdbt.slack.com/archives/C05C28V7CPP"><img src="https://img.shields.io/badge/Slack-4A154B?style=flat-square&amp;logo=slack&amp;logoColor=white" alt="Slack"></a> &nbsp; 
    <a href="https://discord.com/invite/5zb2aK9KBV"><img src="https://img.shields.io/discord/664381609771925514?color=%237289DA&amp;label=chat&amp;logo=discord&amp;logoColor=white&amp;style=flat-square" alt="InfuseAI Discord Invite"></a> &nbsp; 
</p>

# Introduction

`Recce` is a toolkit for performing data validation in the context of data modeling and PR review for dbt projects.

Data validations, or 'checks', are a method of impact assessment performed by comparing the data in two dbt environments, such as development and production schemas. `Recce` enables the identifying and investigating of data change throughout the pull request process, from data modeling to stakeholder approval. 

<a href="https://datarecce.io"><img src="https://datarecce.io/assets/images/landing/home/featured_image.png" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 20px;" /></a>

# Why `Recce`

[dbt](https://www.getdbt.com/) has brought many software best practices to data projects, such as:

- Version controlled code
- Modular SQL
- Reproducible pipelines 

Even so, 'bad merges' still happen, in which updated data models are merged in production without proper checks. Resulting in erroneous data, silent errors, or even data downtime. This is due to the unique situation encountered by reviewers of having to review both the code (data models) and the resultant data.

In addition, the dbt culture of 'self-serve analytics' has opened up data pipelines to the wider data team. This means that many roles, all with differing priorities, are modifying the dbt pipeline making the job of reviewing pull requests (PR) difficult. Impact assessment and data QA is also made difficult by the growing size and complexity of dbt projects.

The best way to understand the impact of code changes on data is to compare the data before-and-after the changes. To ensure:

- historical data is not impacted (does not change) and
- intentional modifications have the desired impact.

This is where `Recce` comes in, by providing a self-serve review environment for the self-serve data platform specifically geared towards surfacing and understanding data impact from code changes.


# `Recce` Use cases

Recce is designed for reviewing data change, which can happen at many stages PR process:

## Development

Start a Recce server locally, during development, to inspect and investigate how your data modeling changes are impacting the data in your development schema compared to prod.

## PR Review

Recce can be used by both the author or the PR, and the reviewer.

## Manual data checks
Copy the results of your development-time data validations into the PR comment to show that you have done your due diligence and performed QA on your work.

## Preset checks in CI
Get full coverage of your pipeline by setting up preset checks that run on all PRs. `Recce Cloud` users can take advantage of our GitHub app that will enable the blocking of merging and alerting to unapproved checks. 

## Automated Impact Summary
If data change from any of your checks is detected then the `Recce` Summary will show which ones. Run Recce in review mode to investigate the impact. 

Ru it in CI, why?

# Who's using `Recce`?

Teams can do what?

**Data engineers** can use Recce to ensure the structural integrity of the data and understand the scope of impact before merging.

**Analysts** can use Recce to self-review and understasnd how data modeling changes have changed the data.

**Stakeholders** can use Recce to sign-off on data after updates have been made

### Other uses

For troubleshooting, you can execute ad-hoc diff queries to pinpoint the root causes.

# Demo

Try Recce out for yourself with our hosted demo instance:

# Data Security

What Recce does and doesn't do

# Recce Cloud


# Community &amp; Support

Where can you get help?


# Documentation

Please check the [Recce Documentation](https://datarecce.io/docs/)
