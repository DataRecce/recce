# Testing Guide

This document describes the test architecture for the Recce frontend.

## Overview

We use **Vitest** as the test runner across all packages:

| Package                  | Tests                            | Command                                     |
| ------------------------ | -------------------------------- | ------------------------------------------- |
| Root (`js/`)             | App-level tests                  | `pnpm test`                                 |
| `@datarecce/ui`          | Component unit tests             | `pnpm test:ui`                              |
| `@datarecce/storybook`   | Story tests + visual regression  | `pnpm --filter @datarecce/storybook test`   |

## Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:cov

# UI package only
pnpm test:ui

# Storybook interaction tests
pnpm --filter @datarecce/storybook test

# Visual regression tests
pnpm --filter @datarecce/storybook test:visual
```

## Test File Naming

| Pattern          | Purpose                              |
| ---------------- | ------------------------------------ |
| `*.test.ts`      | Unit tests (Vitest)                  |
| `*.test.tsx`     | React component tests (Vitest)       |
| `*.stories.tsx`  | Storybook stories                    |
| `*.visual.ts`    | Visual regression tests (Playwright) |

## Configuration Files

```
js/
├── vitest.config.mts             # Root package config
├── vitest.setup.ts               # Shared test setup
├── packages/
│   ├── ui/
│   │   └── vitest.config.ts      # UI package config
│   └── storybook/
│       ├── vitest.config.ts      # Story test config
│       └── playwright.config.ts  # Visual regression config
```

## Writing Tests

### Unit Tests

```typescript
import { describe, expect, it, vi } from "vitest";

describe("myFunction", () => {
  it("returns expected value", () => {
    expect(myFunction("input")).toBe("output");
  });
});
```

### Component Tests

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("MyComponent", () => {
  it("handles click", async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalled();
  });
});
```

### Mocking

```typescript
// Mock a module
vi.mock("./myModule", () => ({
  myFunction: vi.fn(() => "mocked"),
}));

// Mock a hook
vi.mock("../hooks/useMyHook", () => ({
  useMyHook: () => ({ data: "mocked" }),
}));
```

## CI Integration

Tests run automatically on:

- Pull requests
- Pushes to main

Visual regression tests upload artifacts on failure for review.
