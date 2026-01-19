# Storybook Package - Claude Guidance

## Testing Portal-Rendered Content (MUI Dialogs, Popovers)

MUI components like `Dialog`, `Popover`, `Menu`, and `Modal` render their content via React Portals **outside** the story's canvas element. This affects how you query elements in Storybook interaction tests.

### The Problem

```typescript
// ❌ WRONG - canvas is scoped to canvasElement, won't find portal content
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button"));

  // This fails because the dialog is rendered outside canvasElement
  expect(canvas.getByText("Dialog Title")).toBeInTheDocument();
}
```

### The Solution

Use `screen` from `storybook/test` for portal-rendered content:

```typescript
// ✅ CORRECT - screen queries the entire document
import { expect, screen, userEvent, within } from "storybook/test";

play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  // Use canvas for elements inside the story
  await userEvent.click(canvas.getByRole("button"));

  // Use screen for portal-rendered content (dialogs, popovers, menus)
  expect(screen.getByText("Dialog Title")).toBeInTheDocument();
  const closeButton = screen.getByRole("button", { name: /close/i });
  await userEvent.click(closeButton);
}
```

### When to Use Each

| Query Target | Use |
|-------------|-----|
| Buttons, inputs inside the story | `canvas` (from `within(canvasElement)`) |
| MUI Dialog content | `screen` |
| MUI Popover content | `screen` |
| MUI Menu items | `screen` |
| MUI Modal content | `screen` |
| Tooltip content | `screen` |

### Affected Components

Any MUI component that uses `Portal` internally:
- `Dialog`, `DialogTitle`, `DialogContent`, `DialogActions`
- `Popover`
- `Menu`, `MenuItem`
- `Modal`
- `Tooltip`
- `Snackbar`
- `Drawer` (when using portal mode)
