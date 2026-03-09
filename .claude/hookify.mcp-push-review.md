---
name: mcp-push-review
enabled: true
event: bash
pattern: git\s+push
action: warn
---

**MCP push review gate triggered.**

Before pushing, check if any MCP-related files were modified in the commits being pushed:

```
git diff origin/main...HEAD --name-only | grep -E '(recce/mcp_server\.py|tests/test_mcp_server\.py|tests/test_mcp_e2e\.py|\.claude/skills/recce-mcp-dev/)'
```

**If MCP files are found in the diff**, ask the user:

> MCP-related files were modified. Before pushing, would you like to:
> 1. Review MCP skill with `/superpowers:writing-skills` (checks `.claude/skills/recce-mcp-dev/SKILL.md` is up to date)
> 2. Review CLAUDE.md with `/claude-md-management:revise-claude-md` (checks MCP-related sections are current)
> 3. Skip — push without review

**If NO MCP files are found**, proceed with push normally without prompting.
