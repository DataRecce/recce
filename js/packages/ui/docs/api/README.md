**@datarecce/ui**

***

# @datarecce/ui

Shared UI library for Recce OSS and Recce Cloud.

## Quick Start

Install (workspace):

```bash
cd js
pnpm install
```

Basic usage with `RecceProvider`:

```tsx
import { RecceProvider } from "@datarecce/ui/providers";
import { LineageView } from "@datarecce/ui/components/lineage";

export function App() {
  return (
    <RecceProvider api={{ baseUrl: "/api" }}>
      <LineageView />
    </RecceProvider>
  );
}
```

Primitives and advanced exports:

```tsx
import { DiffText, HSplit } from "@datarecce/ui/primitives";
import { LineageCanvas, useThemeColors } from "@datarecce/ui/advanced";
```

## API Reference

Generate API reference via TypeDoc:

```bash
cd js/packages/ui
pnpm docs:api
```

The generated output lives in `js/packages/ui/docs/api/`.

## TypeScript Types

All exports ship with TypeScript definitions. Use the exported types from the
same module path as the component or hook you import.

## Environment overrides

@datarecce/ui ships defaults for public URLs, but you can override them via Next.js env vars:

- `NEXT_PUBLIC_API_URL` - overrides the default API base URL.
- `NEXT_PUBLIC_RECCE_SUPPORT_CALENDAR_URL` - overrides the support calendar URL.

These values are read from `process.env` at runtime in the host app.
