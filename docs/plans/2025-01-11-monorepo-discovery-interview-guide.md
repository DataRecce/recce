# Monorepo Discovery Interview Guide

## Purpose

This guide helps gather information about a partner's dbt monorepo structure to inform Recce's monorepo support strategy.

**Target audience:** Data engineers / Analytics engineers familiar with dbt.

**Format:** Can be used for live conversation or sent as written questions.

---

## Background: dbt Monorepo Types

Before the interview, understand that dbt monorepos typically fall into three categories:

### Type A: Multi-Project (Independent)

```
repo/
├── project-a/
│   └── dbt_project.yml
└── project-b/
    └── dbt_project.yml
```

- Projects have no dependencies on each other
- May connect to different data warehouses
- Colocated for convenience

### Type B: Multi-Project (Cross-Project References)

```
repo/
├── core/
│   └── dbt_project.yml      # Base models
├── marketing/
│   └── dbt_project.yml      # ref('core', 'users')
└── finance/
    └── dbt_project.yml      # ref('core', 'transactions')
```

- Uses dbt 1.6+ cross-project ref
- Clear dependency order between projects

### Type C: Single Project, Multi-Environment

```
repo/
└── dbt_project.yml
    # Uses targets for dev/staging/prod
    # Or selectors for different domains
```

- Technically one project
- Teams may treat different domains as separate "projects"

---

## Interview Questions

### Part 1: Basic Structure

**Goal:** Quickly identify which monorepo type they have.

**Q1: How many `dbt_project.yml` files are in your repository?**

(If only one, skip to Q4)

**Q2: Do these dbt projects have dependencies on each other?**

For example: Does project B use `ref('project_a', 'model_name')` to reference models from project A? Or are they completely independent?

**Q3: Do these projects connect to the same data warehouse, or different ones?**

For example: All Snowflake? Or some BigQuery, some Redshift?

---

### Part 2: Development Workflow

**Goal:** Understand how they develop and deploy, which affects Recce integration.

**Q4: When you open a PR, how many projects does it typically touch?**

Do most PRs only change one project, or do you frequently change multiple projects together?

**Q5: How do you generate production dbt artifacts (manifest.json, catalog.json)?**

Do you run `dbt docs generate` separately for each project, or is there a unified CI job? Where are these artifacts stored?

**Q6: Do you currently do any data validation or data diff in your PR workflow?**

If yes, what tools or methods do you use? What challenges have you encountered?

---

### Part 3: Pain Points & Expectations

**Goal:** Understand their actual problems and expectations for Recce.

**Q7: With your current monorepo structure, what's the hardest part about reviewing data changes?**

For example: Not knowing which downstream models are affected? Having to check each project separately? Lack of visibility into cross-project lineage?

**Q8: If a tool could help you with data validation in your monorepo, what would you most want it to do?**

(Open-ended - let them describe their ideal state)

**Q9: Is there anything we didn't ask about that you think we should know?**

---

## Quick Classification Guide

After the interview, use this to classify their monorepo type:

```
Q1: How many dbt_project.yml?
│
├── 1 → Type C (Single Project, Multi-Environment)
│
└── 2+ → Q2: Do projects have dependencies?
          │
          ├── Yes (cross-project ref) → Type B (Cross-Project References)
          │
          └── No → Type A (Multi-Project Independent)
```

---

## Notes

- Record the interview answers
- Note any requirements or use cases that don't fit the three types
- Capture specific pain points verbatim - these inform feature prioritization
