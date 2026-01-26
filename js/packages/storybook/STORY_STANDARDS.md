# Storybook Story Standards

This document describes the established patterns and standards for writing Storybook stories in this project, based on existing stories (`TimelineEvent.stories.tsx` and `EnvInfo.stories.tsx`).

## File Structure

Each feature domain gets its own subdirectory:

```
packages/storybook/stories/
  {feature-domain}/
    {ComponentName}.stories.tsx
    fixtures.ts
    {ComponentName}.test.tsx       (optional - unit tests)
    {ComponentName}.visual.ts      (optional - visual regression tests)
```

Example:
```
stories/
  timeline/
    TimelineEvent.stories.tsx
    fixtures.ts
    TimelineEvent.test.tsx
    TimelineEvent.visual.ts
```

## Fixtures Pattern

### Factory Functions with Overrides

Create reusable factory functions that return mock data with sensible defaults:

```typescript
/**
 * Create a fixture with sensible defaults
 */
export const createThing = (
  overrides: Partial<ThingType> = {}
): ThingType => ({
  id: `thing-${Math.random().toString(36).slice(2, 9)}`,
  name: "Default Name",
  status: "active",
  createdAt: new Date().toISOString(),
  ...overrides,  // Allow partial customization
});
```

### Multiple Fixture Variants

Provide specialized factory functions for common variants:

```typescript
// Base factory
export const createEvent = (overrides = {}) => ({ ... });

// Specialized variant
export const createCommentEvent = (overrides = {}) =>
  createEvent({
    event_type: "comment",
    content: "Default comment text.",
    ...overrides,
  });
```

### Reusable Data Objects

Export reusable data objects for multi-story scenarios:

```typescript
export const sampleActor = {
  user_id: "user-1",
  fullname: "John Doe",
  login: "johndoe",
  avatarUrl: "https://i.pravatar.cc/150?u=johndoe",
};

export const otherActor = {
  user_id: "user-2",
  fullname: "Jane Smith",
  login: "janesmith",
  avatarUrl: "https://i.pravatar.cc/150?u=janesmith",
};
```

### Fixture Documentation

- Add JSDoc comments explaining what each factory creates
- Use TypeScript types for parameter safety
- Include realistic data (URLs, dates, IDs)

## Story File Structure

### 1. Imports

```typescript
import { Component } from "@datarecce/ui/...";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { createFixture, sampleData } from "./fixtures";
```

### 2. Meta Configuration

```typescript
const meta: Meta<typeof Component> = {
  title: "Category/ComponentName",
  component: Component,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Brief description of what this component does and its main purpose."
      }
    },
    layout: "centered", // or "fullscreen" - optional
  },
  decorators: [
    // Optional - wrap with providers if needed
    (Story) => (
      <Provider>
        <Story />
      </Provider>
    ),
  ],
  argTypes: {
    propName: {
      description: "What this prop does",
      control: "text", // or "select", "boolean", "number", "object"
      action: "propName", // optional - logs to Actions panel
    },
  },
};

export default meta;
type Story = StoryObj<typeof Component>;
```

### 3. Story Organization with Comments

Group related stories with section comments:

```typescript
// ============================================
// Primary Use Cases
// ============================================

export const Default: Story = { ... };
export const WithData: Story = { ... };

// ============================================
// Interactive Behaviors
// ============================================

export const Editable: Story = { ... };
export const Deletable: Story = { ... };

// ============================================
// Edge Cases
// ============================================

export const EmptyState: Story = { ... };
export const ErrorState: Story = { ... };
```

### 4. Story Definition

```typescript
export const StoryName: Story = {
  name: "Display Name", // optional - overrides export name
  args: {
    prop1: "value",
    prop2: createFixture(),
    onCallback: fn(), // Mock callbacks for interaction tracking
  },
  parameters: {
    docs: {
      description: {
        story: "Brief explanation of what this story demonstrates."
      }
    }
  },
  play: async ({ canvasElement }) => {
    // Optional - interactive tests
  },
};
```

## Story Coverage Pattern

Each component should have stories covering:

1. **Primary use cases** - Main variants and configurations
2. **Interactive behaviors** - User interactions (clicks, hovers, edits)
3. **Edge cases** - Empty states, missing data, fallbacks
4. **Different modes** - If component has mode switches (dev/review, light/dark)

Typical story count: **5-15 stories** depending on component complexity

## Documentation Style

### Component-Level Description

Single paragraph explaining the component's purpose:

```typescript
parameters: {
  docs: {
    description: {
      component: "Renders timeline events including comments, approvals, and state changes. Supports different event types with appropriate icons and styling."
    }
  }
}
```

### Story-Level Description

Only add when the story needs clarification beyond its name:

```typescript
parameters: {
  docs: {
    description: {
      story: "When the current user is the comment author, edit and delete buttons appear on hover."
    }
  }
}
```

### No Code Snippets

- Let Storybook's autodocs generate code examples from args
- Focus on prose descriptions, not code blocks
- Keep descriptions concise (1-2 sentences)

## Interactive Testing with Play Functions

### Basic Pattern

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Query elements within the story
  const button = canvas.getByRole("button", { name: /click me/i });
  await userEvent.click(button);

  // Assert results
  expect(canvas.getByText("Result")).toBeInTheDocument();
}
```

### Portal Content Testing (MUI Dialogs, Popovers, Menus)

MUI components render via portals **outside** the canvas element. Use `screen` for portal content:

```typescript
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Click button inside story using canvas
  await userEvent.click(canvas.getByRole("button"));

  // Query portal-rendered content using screen
  expect(screen.getByText("Dialog Title")).toBeInTheDocument();

  // Interact with portal content using screen
  const closeButton = screen.getByRole("button", { name: /close/i });
  await userEvent.click(closeButton);
}
```

**Rule of thumb:**
- `canvas` (from `within(canvasElement)`) → Elements inside the story
- `screen` → Portal-rendered content (Dialog, Popover, Menu, Modal, Tooltip)

### Testing Callbacks

Mock callbacks with `fn()` to track interactions:

```typescript
args: {
  onEdit: fn(),
  onDelete: fn(),
},
play: async ({ canvasElement, args }) => {
  // ... trigger interaction ...
  expect(args.onEdit).toHaveBeenCalled();
  expect(args.onDelete).toHaveBeenCalledWith("expected-value");
}
```

### Testing Interactions

```typescript
// Hover
await userEvent.hover(element);

// Click
await userEvent.click(button);

// Type
await userEvent.type(input, "text to type");

// Wait for async changes
await new Promise((resolve) => setTimeout(resolve, 300));
```

## Naming Conventions

### Story Exports

Use PascalCase export names that describe the variant:

```typescript
export const Default: Story = { ... };
export const WithData: Story = { ... };
export const EmptyState: Story = { ... };
export const ActorWithoutAvatar: Story = { ... };
export const CommentDeleteConfirmation: Story = { ... };
```

### Display Names

Add `name` property when the display name should be more readable:

```typescript
export const DbtDevMode: Story = {
  name: "DBT - Dev Mode",  // Displays as "DBT - Dev Mode" in Storybook
  ...
};
```

### Story Sections

Use ALL CAPS comments with decorative borders:

```typescript
// ============================================
// Section Name
// ============================================
```

## ArgTypes Configuration

Document props using argTypes with descriptions and controls:

```typescript
argTypes: {
  title: {
    description: "The component title",
    control: "text",
  },
  status: {
    description: "Current status",
    control: "select",
    options: ["active", "inactive", "pending"],
  },
  count: {
    description: "Number of items",
    control: "number",
  },
  enabled: {
    description: "Enable feature",
    control: "boolean",
  },
  onAction: {
    description: "Callback when action occurs",
    action: "action-triggered", // Logs to Actions panel
  },
  complexObject: {
    description: "Complex data object",
    control: "object",
  },
  internalProp: {
    description: "Internal prop not meant for external use",
    control: false, // Hide from controls
  },
}
```

## Import Patterns

### Public Exports

Always use public exports from `@datarecce/ui`:

```typescript
import { Component } from "@datarecce/ui";
import { Component } from "@datarecce/ui/primitives";
import { Component } from "@datarecce/ui/components";
```

**Never** import from internal paths:
```typescript
// ❌ DON'T DO THIS
import { Component } from "@datarecce/ui/src/components/...";
```

## Testing Integration

Stories can be tested with:

1. **Vitest** - Unit test stories with `vitest` command
2. **Playwright** - Visual regression with `test:visual` command
3. **Interaction tests** - Built-in with `play` functions

Stories are automatically discovered and tested by the test infrastructure.

## Key Principles

1. **Reusable fixtures** - DRY principle with factory functions
2. **Realistic data** - Use believable names, dates, URLs
3. **Progressive complexity** - Simple stories first, complex interactions later
4. **Self-documenting** - Clear names and descriptions, minimal prose
5. **Comprehensive coverage** - Happy path, edge cases, interactions
6. **Portal awareness** - Use `screen` for MUI portal content
7. **Type safety** - Use TypeScript types throughout
8. **Consistent organization** - Follow established patterns
