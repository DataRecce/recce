# @datarecce/ui Adapter Patterns

**Date:** 2026-01-10
**Status:** Active
**Audience:** Consumers of @datarecce/ui (Recce OSS, recce-cloud-infra)

## Overview

This document explains how to integrate @datarecce/ui into your application, including how to wrap/extend library contexts, bridge themes, and handle application-specific concerns like WebSockets.

## Architecture Principles

1. **Library provides stateless components** - Props-driven, no direct API calls
2. **Consumers provide data-fetching adapters** - OSS/Cloud wrap library contexts
3. **Types are library-owned** - Discriminated unions, interfaces in @datarecce/ui
4. **Utilities are generic** - No application-specific dependencies

---

## Provider Stacking Order

When using @datarecce/ui providers, follow this recommended order:

```tsx
// Outer to inner
<ThemeProvider>        {/* 1. Theme (CSS variables, color mode) */}
  <RecceProvider>      {/* 2. Recce library context (API config, feature flags) */}
    <YourAppProviders> {/* 3. App-specific providers */}
      <App />
    </YourAppProviders>
  </RecceProvider>
</ThemeProvider>
```

### Why This Order?

1. **ThemeProvider first** - CSS variables must be available before any styled components render
2. **RecceProvider second** - Library components may use `useApiConfig` or other contexts
3. **App providers last** - Can access both theme and library contexts

---

## Wrapping Library Contexts

### Pattern: OSS Adapter

When your application needs additional defaults or behavior beyond what the library provides:

```tsx
// src/lib/hooks/ApiConfigContext.tsx (OSS example)

import { useApiConfigOptional } from "@datarecce/ui/contexts";
import { createContext, useContext } from "react";

interface OSSApiConfig {
  baseUrl: string;
  // ... additional OSS-specific config
}

const OSSApiConfigContext = createContext<OSSApiConfig | null>(null);

export function useApiConfig(): OSSApiConfig {
  // Priority chain:
  // 1. Local OSS provider (if present)
  const localConfig = useContext(OSSApiConfigContext);
  if (localConfig) return localConfig;

  // 2. @datarecce/ui provider (via useApiConfigOptional)
  const libraryConfig = useApiConfigOptional();
  if (libraryConfig) return libraryConfig;

  // 3. OSS-specific defaults
  return {
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api/v1",
  };
}
```

### Pattern: Cloud Adapter

For recce-cloud-infra with different authentication and base URLs:

```tsx
// Cloud adapter pattern (conceptual)
import { RecceProvider } from "@datarecce/ui";

export function CloudRecceProvider({ children }) {
  const cloudConfig = useCloudAuth(); // Cloud-specific auth

  return (
    <RecceProvider
      apiConfig={{
        baseUrl: cloudConfig.apiEndpoint,
        headers: {
          Authorization: `Bearer ${cloudConfig.token}`,
        },
      }}
    >
      {children}
    </RecceProvider>
  );
}
```

---

## Theme Bridging

### CSS Variables (Recommended)

@datarecce/ui uses CSS variables for theming. This enables consumers to customize without rebuilding the library.

```css
/* Override in your app's CSS */
:root {
  --recce-primary: #0066cc;
  --recce-background: #ffffff;
  --recce-text: #1a1a1a;
}

[data-theme="dark"] {
  --recce-primary: #4da6ff;
  --recce-background: #1a1a1a;
  --recce-text: #ffffff;
}
```

### Legacy Mode (MUI Theme)

For applications using MUI's `createTheme`:

```tsx
import { createTheme } from "@mui/material/styles";

// Bridge CSS variables to MUI theme
const theme = createTheme({
  palette: {
    primary: {
      main: "var(--recce-primary)",
    },
    background: {
      default: "var(--recce-background)",
    },
  },
});
```

### Accessing Theme Colors

Use the library's `useThemeColors` hook for consistent colors:

```tsx
import { useThemeColors } from "@datarecce/ui/hooks";

function MyComponent() {
  const colors = useThemeColors();
  return <div style={{ color: colors.primary }}>Themed content</div>;
}
```

---

## What Stays in OSS vs Library

### Screenshot Utilities

**Status:** Remain in OSS

The screenshot utilities (`useCopyToClipboard`, `useCopyToClipboardButton`, `useImageDownloadModal`) remain in OSS because they depend on:

- `DataGridHandle` type (OSS-specific AG Grid wrapper)
- `colors` from OSS MUI theme (for default values)

**What's available from library:**
- `useClipBoardToast` - Toast notifications for clipboard operations

**OSS pattern:**
```tsx
// OSS imports toast from library, implements screenshot locally
import { useClipBoardToast } from "@datarecce/ui/hooks";
import { useCopyToClipboard } from "@/lib/hooks/ScreenShot";
```

### Run History

**Status:** Requires evaluation per consumer

Run history components should be evaluated by each consumer (OSS, Cloud) to determine if generic patterns can be extracted. Current implementations are tightly coupled to application-specific state management.

---

## WebSocket Strategy

**Decision:** WebSocket handling is left to consumers.

### Rationale

Both OSS and Cloud have deployment-specific WebSocket implementations:

| Aspect | OSS | Cloud |
|--------|-----|-------|
| Connection URL | Local server (`ws://localhost:8000`) | Cloud gateway (`wss://api.recce.cloud`) |
| Authentication | None (local only) | Token-based |
| Reconnection | Simple retry | Complex with backoff |
| State sync | Direct to Python backend | Through cloud proxy |

### Consumer Implementation

OSS example (LineageGraphAdapter.tsx):

```tsx
// OSS WebSocket handling
useEffect(() => {
  const ws = new WebSocket(`${baseWsUrl}/ws/lineage`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateLineageState(data);
  };

  return () => ws.close();
}, [baseWsUrl]);
```

Cloud consumers implement their own WebSocket handling with appropriate authentication and error handling.

---

## Type Re-exports

When the library provides types, OSS should re-export for backward compatibility:

```tsx
// src/lib/api/types.ts (OSS)
export type { RunType, Run, RunStatus } from "@datarecce/ui/api";

// Additional OSS-specific types
export interface OSSSpecificRun extends Run {
  // OSS additions
}
```

---

## Migration Checklist

When migrating code to @datarecce/ui:

1. **Identify dependencies**
   - [ ] Does it import from OSS-specific paths (`@/`, `src/`)?
   - [ ] Does it use OSS-specific contexts?
   - [ ] Does it make direct API calls?

2. **Evaluate library-readiness**
   - [ ] Can it be made props-driven?
   - [ ] Can dependencies be injected?
   - [ ] Is it generic enough for multiple consumers?

3. **Migration pattern**
   - [ ] Move pure logic to @datarecce/ui
   - [ ] Create OSS wrapper if needed
   - [ ] Update imports to use library
   - [ ] Add re-exports for backward compatibility

---

## Questions?

For questions about adapter patterns or migration, open an issue in the recce repository.
