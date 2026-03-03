# @datarecce/storybook

Component documentation and testing for `@datarecce/ui` using Storybook.

## Quick Start

```bash
# From js/ directory
pnpm storybook

# Or from this package
cd packages/storybook
pnpm storybook
```

Open http://localhost:6006 to view the component catalog.

## Running Tests

```bash
# Interaction tests (portable stories + Vitest)
pnpm test

# Visual regression tests (Playwright)
pnpm test:visual

# Update visual baselines
pnpm test:visual:update
```

## Project Structure

```
packages/storybook/
├── .storybook/           # Storybook configuration
│   ├── main.ts          # Addons, framework config
│   ├── preview.tsx      # Global decorators (theme, providers)
│   └── vitest.setup.ts  # Test setup
├── stories/
│   ├── timeline/        # Timeline components
│   ├── data/            # Data visualization components
│   ├── lineage/         # Lineage graph components
│   └── ui/              # Generic UI components
├── playwright.config.ts # Visual regression config
└── vitest.config.ts     # Interaction test config
```

## Writing Stories

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidance on:

- Creating new stories
- Writing interaction tests
- Adding visual regression tests
- Best practices

## Related Documentation

- [Testing Guide](../../TESTING.md) - Overall test architecture
- [@datarecce/ui](../ui/README.md) - Component library
