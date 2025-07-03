<p align="center">
    <a href="https://datarecce.io">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.avif">
            <source media="(prefers-color-scheme: light)" srcset="https://datarecce.io/assets/images/recce-logo-stacked.avif">
            <img alt="Recce: DataRecce.io" src="https://datarecce.io/assets/images/recce-logo-stacked.avif" width="200" style="display: block; margin: 0 auto 20px;">
        </picture>
    </a>
</p>

<h3 align="center">Helping data teams preview, validate, and ship data changes with confidence.</h3>

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

## Trust, Verify, Ship
Cut dbt review time by 90% and ship accurate data fast

Recce gives data teams a faster, more reliable way to understand, review, and ship changes without all the guesswork or manual overhead.

## Quick Start
You can launch Recce in any dbt project in just two commands:

```Bash
# cd into your dbt project
pip install -U recce
recce server
```
This starts Recce locally, where you can explore lineage and run queries. To unlock the full set of diffing tools, such as data comparisons and impact checks, you’ll need to prepare two environments to compare against. You can follow our [Getting Started](https://docs.datarecce.io/get-started/) and [5-minute Jaffle Shop tutorial](https://docs.datarecce.io/get-started-jaffle-shop/) to try it out step-by-step.

## What You Get

Recce gives you a clear, fast way to understand what your data changes are doing and why they matter. It helps you catch problems early, verify metrics, and share your findings with others, all as part of your normal workflow.

<a href="https://pr46.demo.datarecce.io/"><img width="1347" alt="readme" src="https://github.com/user-attachments/assets/773e4c3a-0a15-49e0-8d1b-38a55af17cb0" /></a>

<a href="https://datarecce.io"><img src="https://docs.datarecce.io/assets/images/home/diff-readme2.png" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 20px;" alt="Model and column level diff"/></a>

<a href="https://datarecce.io"><img src="https://docs.datarecce.io/assets/images/home/checklist-readme3.png" style="width: 100%; max-width: 600px; display: block; margin: 0 auto 20px;" alt="Checklist for collaboration"/></a>

### Using Recce for Impact Assessment in dbt PR Review

- Select nodes in the lineage to perform Checks (diffs) as part of your impact assessment during development or PR
  review.
- Add Checks to your Checklist to note observed impacts.
- Share your Checklist with the PR reviewer.
- (`Recce Cloud`) Automatically sync Check status between Recce Instances
- (`Recce Cloud`) Block PR merging until all Recce Checks have been approved

Read more about using [Recce for Impact Assessment](https://datarecce.io/blog/hands-on-data-impact-analysis-recce/) on
the Recce blog.

### What’s Included

- [Lineage and impact mapping](https://docs.datarecce.io/features/lineage/): Quickly see which models and columns are affected by a change. Navigate lineage down to the column level, and spot breaking changes with clear visual cues.
- Metric and data comparisons: Use [Profile, Value, Top-K, and Histogram Diffs](https://docs.datarecce.io/features/lineage/#node-details) to compare results before and after changes. Validate things like row counts, category distributions, and numeric ranges without writing extra SQL.
- [Query diff](https://docs.datarecce.io/features/query/): Write and compare any two queries side by side. This is helpful when validating fixes or reviewing changes with teammates.
- [Checklist for reviews and approvals](https://docs.datarecce.io/features/checklist/): Turn your validation steps into a checklist. Add notes, rerun checks, and share the results with reviewers or stakeholders. In Recce Cloud, checklists can sync automatically and even block PRs until checks are approved.
- Secure by design: Recce is [SOC 2 compliant](https://trust.cloud.datarecce.io/) to meet enterprise security standards. It runs locally or in your private environment, and your data stays in your warehouse.

👉 Want to dive deeper? Check out the [full documentation](https://docs.datarecce.io/) like [running Recce in CI/CD](https://docs.datarecce.io/guides/scenario-ci/)

## Recce Cloud

Ready to collaborate and move faster as a team? Recce Cloud adds real-time collaboration, automatic checklist sync, and PR gating, so nothing gets merged without a full review.

- Share checklists across environments
- Invite stakeholders to review data changes
- Block merges until all Checks are approved
- Launch demo links from your CI with full context

Recce Cloud is a hosted version of Recce that standardizes your workflow, keeps teams aligned, and reduces errors—so you can ship data changes with confidence.
👉 [View Pricing and Plans](https://datarecce.io/pricing)

## Community & Support

Here's where you can get in touch with the Recce team and find support:

- [dbt Slack](https://www.getdbt.com/community/join-the-community) in
  the [#tools-recce](https://getdbt.slack.com/archives/C05C28V7CPP) channel
- Email us [product@datarecce.io](mailto:product@datarecce.io)

If you believe you have found a bug, or there is some missing functionality in Recce, please open
a [GitHub Issue](https://github.com/DataRecce/recce/issues).

## Recce on the web

You can follow along with news about Recce and blogs from our team in the following places:

- [RecceHQ.com](https://reccehq.com/)
- [LinkedIn](https://www.linkedin.com/company/datarecce)
- [Medium blog](https://medium.com/inthepipeline)
- [@datarecce](https://x.com/DataRecce) on Twitter/X
- [@DataRecce@mastodon.social](https://mastodon.social/@DataRecce) on Mastodon
- [@datarecce.bsky.social](https://bsky.app/profile/datarecce.bsky.social) on BlueSky
