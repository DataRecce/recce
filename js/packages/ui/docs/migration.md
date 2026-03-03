# Migration Guide: Transitioning to @datarecce/ui

This guide explains how to migrate to the shared `@datarecce/ui` library.
Target audiences: Recce OSS maintainers, recce-cloud-infra developers, and future external consumers.

## 1. Step-by-step integration

1) Install dependencies:

```bash
cd js
pnpm install
```

2) Wrap your app with `RecceProvider`:

```tsx
import { RecceProvider } from "@datarecce/ui/providers";

export function App() {
  return (
    <RecceProvider api={{ baseUrl: "/api" }}>
      <YourApp />
    </RecceProvider>
  );
}
```

3) Replace local component imports with library imports:

```tsx
import { LineageView } from "@datarecce/ui/components/lineage";
import { DiffText } from "@datarecce/ui/primitives";
```

## 2. RecceProvider setup and configuration

`RecceProvider` is the top-level context container. It supports:

- `api`: base configuration or custom axios client
- `theme`: `"light" | "dark" | "system"`
- `routing`: router integration (e.g., Next.js)
- `queryClient`: TanStack Query settings
- `runActions`, `lineage`, `checks`, `query`: props-driven contexts (see section 6)
- `features`: disable unused contexts

Example:

```tsx
<RecceProvider
  api={{ baseUrl: "/api", headers: { "x-recce": "oss" } }}
  theme="system"
  routing={{ basePath: "/app", pathname, onNavigate }}
  queryClient={{ staleTime: 60_000, gcTime: 5 * 60_000 }}
  features={{ enableLineage: true, enableChecks: true }}
>
  <YourApp />
</RecceProvider>
```

## 3. Migrating from local components to library imports

Before:

```tsx
import { LineageView } from "@/components/lineage/LineageView";
```

After:

```tsx
import { LineageView } from "@datarecce/ui/components/lineage";
```

Guidelines:
- Use public export paths (`@datarecce/ui`, `@datarecce/ui/components/...`).
- Do not import from `js/packages/ui/src/*`.
- OSS-specific variants are suffixed with `*Oss`.

## 4. Theme integration (with and without RecceProvider)

**With RecceProvider** (recce-cloud-infra):
- `useRecceTheme` and `useThemeColors` read from ThemeContext.
- Set `theme` via `RecceProvider`.

**Without RecceProvider** (OSS + next-themes):
- `useThemeColors` falls back to DOM class detection.
- `useIsDark` uses the `.dark` class on `html`.

Example:

```tsx
import { useThemeColors } from "@datarecce/ui/advanced";

const { background, text } = useThemeColors();
```

## 5. API client configuration patterns

**Recommended (RecceProvider):**

```tsx
<RecceProvider api={{ baseUrl: "/api" }}>
  <YourApp />
</RecceProvider>
```

**Custom axios client:**

```tsx
import axios from "axios";

const client = axios.create({ baseURL: "/api", timeout: 20000 });

<RecceProvider api={{ client }}>
  <YourApp />
</RecceProvider>
```

**Without RecceProvider:**
`useApiConfig` falls back to `PUBLIC_API_URL`.

## 6. Adapter layer for props-driven contexts

`@datarecce/ui` contexts expect data and callbacks via props:

- `lineage`: lineage graph + refetch handlers
- `checks`: check list + CRUD callbacks
- `query`: SQL state + callbacks
- `runActions`: run execution + result display handlers

Keep your data fetching and state in an adapter layer, then pass it into `RecceProvider`.

Example (checks):

```tsx
<RecceProvider
  api={{ baseUrl: "/api" }}
  checks={{
    checks,
    isLoading,
    selectedCheckId,
    onSelectCheck,
    onCreateCheck,
    onUpdateCheck,
    onDeleteCheck,
    onReorderChecks,
    refetchChecks,
  }}
>
  <YourApp />
</RecceProvider>
```

## 7. Troubleshooting

**Hook throws `must be used within RecceProvider`:**
- Ensure the component is wrapped by `RecceProvider`.

**API calls are not firing:**
- Confirm `api.baseUrl` is correct.
- For cloud sessions, confirm `apiPrefix` and auth token.

**Theme does not update:**
- OSS: ensure `.dark` class is toggled on `html`.
- Cloud: set `theme="system"` or the desired mode in `RecceProvider`.

**UI changes not visible in `recce server`:**
- Run `cd js && pnpm run build` and restart the server.

## 8. Guidance for external consumers

- Use `RecceProvider` as the single entry point for configuration.
- Import only from public export paths.
- Integrate your router and theme via `routing` and `theme`.
