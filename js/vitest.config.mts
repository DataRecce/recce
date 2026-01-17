import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Path aliases matching tsconfig.json
      "@": path.resolve(__dirname, "./src"),
      "@theme": path.resolve(__dirname, "./theme"),
      app: path.resolve(__dirname, "./app"),
      // Workspace packages - IMPORTANT: specific subpaths MUST come before catch-all
      "@datarecce/ui/api": path.resolve(__dirname, "./packages/ui/src/api.ts"),
      "@datarecce/ui/hooks/useMultiNodesActionOss": path.resolve(
        __dirname,
        "./packages/ui/src/hooks/useMultiNodesActionOss.ts",
      ),
      "@datarecce/ui/hooks/useValueDiffAlertDialogOss": path.resolve(
        __dirname,
        "./packages/ui/src/hooks/useValueDiffAlertDialogOss.tsx",
      ),
      "@datarecce/ui/hooks/useMultiNodesAction": path.resolve(
        __dirname,
        "./packages/ui/src/hooks/useMultiNodesAction.ts",
      ),
      "@datarecce/ui/hooks": path.resolve(
        __dirname,
        "./packages/ui/src/hooks/index.ts",
      ),
      "@datarecce/ui/providers": path.resolve(
        __dirname,
        "./packages/ui/src/providers/index.ts",
      ),
      "@datarecce/ui/contexts": path.resolve(
        __dirname,
        "./packages/ui/src/contexts/index.ts",
      ),
      "@datarecce/ui/utils": path.resolve(
        __dirname,
        "./packages/ui/src/utils/index.ts",
      ),
      "@datarecce/ui/theme": path.resolve(
        __dirname,
        "./packages/ui/src/theme/index.ts",
      ),
      "@datarecce/ui/result": path.resolve(
        __dirname,
        "./packages/ui/src/result.ts",
      ),
      "@datarecce/ui/primitives": path.resolve(
        __dirname,
        "./packages/ui/src/primitives.ts",
      ),
      "@datarecce/ui/components/run/RunToolbar": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/RunToolbar.tsx",
      ),
      "@datarecce/ui/components/run/RunList": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/RunList.tsx",
      ),
      "@datarecce/ui/components/run/registry": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/registry.ts",
      ),
      "@datarecce/ui/components/run/RunResultPane": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/RunResultPane.tsx",
      ),
      "@datarecce/ui/components/run/RunResultPaneOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/RunResultPaneOss.tsx",
      ),
      "@datarecce/ui/components/run": path.resolve(
        __dirname,
        "./packages/ui/src/components/run/index.ts",
      ),
      "@datarecce/ui/components/ui/Toaster": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/Toaster.tsx",
      ),
      "@datarecce/ui/components/ui/DiffDisplayModeSwitch": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/DiffDisplayModeSwitch.tsx",
      ),
      "@datarecce/ui/components/ui/ChangedOnlyCheckbox": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/ChangedOnlyCheckbox.tsx",
      ),
      "@datarecce/ui/components/ui/ScreenshotBox": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/ScreenshotBox.tsx",
      ),
      "@datarecce/ui/components/ui/dataGrid/generators/toValueDataGrid":
        path.resolve(
          __dirname,
          "./packages/ui/src/components/ui/dataGrid/generators/toValueDataGrid.ts",
        ),
      "@datarecce/ui/components/ui/dataGrid/dataGridFactory": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/dataGrid/dataGridFactory.ts",
      ),
      "@datarecce/ui/components/ui/dataGrid/defaultRenderCell": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/dataGrid/defaultRenderCell.tsx",
      ),
      "@datarecce/ui/components/ui/dataGrid/inlineRenderCell": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/dataGrid/inlineRenderCell.tsx",
      ),
      "@datarecce/ui/components/ui/dataGrid/valueDiffCells": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/dataGrid/valueDiffCells.tsx",
      ),
      "@datarecce/ui/components/ui/dataGrid": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/dataGrid/index.ts",
      ),
      "@datarecce/ui/components/data/ScreenshotDataGrid": path.resolve(
        __dirname,
        "./packages/ui/src/components/data/ScreenshotDataGrid.tsx",
      ),
      "@datarecce/ui/components/data/TopKBarChart": path.resolve(
        __dirname,
        "./packages/ui/src/components/data/TopKBarChart.tsx",
      ),
      "@datarecce/ui/components/histogram": path.resolve(
        __dirname,
        "./packages/ui/src/components/histogram/index.ts",
      ),
      "@datarecce/ui/components/summary/ChangeSummary": path.resolve(
        __dirname,
        "./packages/ui/src/components/summary/ChangeSummary.tsx",
      ),
      "@datarecce/ui/components/summary/SchemaSummary": path.resolve(
        __dirname,
        "./packages/ui/src/components/summary/SchemaSummary.tsx",
      ),
      "@datarecce/ui/components/summary": path.resolve(
        __dirname,
        "./packages/ui/src/components/summary/index.ts",
      ),
      "@datarecce/ui/components/valuediff/ValueDiffDetailResultView":
        path.resolve(
          __dirname,
          "./packages/ui/src/components/valuediff/ValueDiffDetailResultView.tsx",
        ),
      "@datarecce/ui/components/valuediff": path.resolve(
        __dirname,
        "./packages/ui/src/components/valuediff/index.ts",
      ),
      "@datarecce/ui/components/app/NavBarOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/NavBarOss.tsx",
      ),
      "@datarecce/ui/components/app/StateSharing": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/StateSharing.tsx",
      ),
      "@datarecce/ui/components/app/EnvInfo": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/EnvInfo.tsx",
      ),
      "@datarecce/ui/components/app/Filename": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/Filename.tsx",
      ),
      "@datarecce/ui/components/app/StateExporter": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/StateExporter.tsx",
      ),
      "@datarecce/ui/components/app/StateSynchronizer": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/StateSynchronizer.tsx",
      ),
      "@datarecce/ui/components/app": path.resolve(
        __dirname,
        "./packages/ui/src/components/app/index.ts",
      ),
      "@datarecce/ui/components/check/timeline/TimelineEventOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/check/timeline/TimelineEventOss.tsx",
      ),
      "@datarecce/ui/components/check/CheckEmptyStateOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/check/CheckEmptyStateOss.tsx",
      ),
      "@datarecce/ui/components/lineage/ActionControlOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/ActionControlOss.tsx",
      ),
      "@datarecce/ui/components/lineage/ColumnLevelLineageControlOss":
        path.resolve(
          __dirname,
          "./packages/ui/src/components/lineage/ColumnLevelLineageControlOss.tsx",
        ),
      "@datarecce/ui/components/lineage/columns": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/columns/index.ts",
      ),
      "@datarecce/ui/components/lineage/GraphEdgeOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/GraphEdgeOss.tsx",
      ),
      "@datarecce/ui/components/lineage/GraphNodeOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/GraphNodeOss.tsx",
      ),
      "@datarecce/ui/components/lineage/lineage": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/lineage.ts",
      ),
      "@datarecce/ui/components/lineage/LineageViewContextMenuOss":
        path.resolve(
          __dirname,
          "./packages/ui/src/components/lineage/LineageViewContextMenuOss.tsx",
        ),
      "@datarecce/ui/components/lineage/LineageViewOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/LineageViewOss.tsx",
      ),
      "@datarecce/ui/components/lineage/topbar/LineageViewTopBarOss":
        path.resolve(
          __dirname,
          "./packages/ui/src/components/lineage/topbar/LineageViewTopBarOss.tsx",
        ),
      "@datarecce/ui/components/lineage/GraphColumnNodeOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/GraphColumnNodeOss.tsx",
      ),
      "@datarecce/ui/components/lineage/nodes": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/nodes/index.ts",
      ),
      "@datarecce/ui/components/lineage/styles": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/styles.tsx",
      ),
      "@datarecce/ui/components/lineage/legend": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/legend/index.ts",
      ),
      "@datarecce/ui/components/lineage/NodeViewOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/NodeViewOss.tsx",
      ),
      "@datarecce/ui/components/lineage/SetupConnectionBannerOss": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/SetupConnectionBannerOss.tsx",
      ),
      "@datarecce/ui/components/lineage": path.resolve(
        __dirname,
        "./packages/ui/src/components/lineage/index.ts",
      ),
      "@datarecce/ui/components/schema": path.resolve(
        __dirname,
        "./packages/ui/src/components/schema/index.ts",
      ),
      "@datarecce/ui/components/notifications": path.resolve(
        __dirname,
        "./packages/ui/src/components/notifications/index.ts",
      ),
      "@datarecce/ui/components/rowcount": path.resolve(
        __dirname,
        "./packages/ui/src/components/rowcount/index.ts",
      ),
      "@datarecce/ui/lib/api/track": path.resolve(
        __dirname,
        "./packages/ui/src/lib/api/track.ts",
      ),
      "@datarecce/ui/components/ui": path.resolve(
        __dirname,
        "./packages/ui/src/components/ui/index.ts",
      ),
      "@datarecce/ui/components": path.resolve(
        __dirname,
        "./packages/ui/src/components/index.ts",
      ),
      // Catch-all MUST be last
      "@datarecce/ui": path.resolve(__dirname, "./packages/ui/src/index.ts"),
      // Mock for ag-grid theme
      agGridTheme: path.resolve(__dirname, "./__mocks__/agGridTheme.ts"),
      // Mock ag-grid-community and ag-grid-react to avoid ESM issues during testing
      "ag-grid-community": path.resolve(
        __dirname,
        "./__mocks__/ag-grid-community.ts",
      ),
      "ag-grid-react": path.resolve(__dirname, "./__mocks__/ag-grid-react.ts"),
      // Fix for html2canvas-pro strict exports in Vite 7.x
      "html2canvas-pro/dist/html2canvas-pro.esm.js": "html2canvas-pro",
    },
  },
  test: {
    // Environment
    environment: "jsdom",

    // Use threads pool instead of forks for better ESM compatibility
    pool: "threads",

    // Setup files
    setupFiles: ["./vitest.setup.mts"],

    // Test patterns
    include: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
    exclude: [
      "**/node_modules/**",
      "**/.worktrees/**",
      "**/packages/storybook/**", // Already uses Vitest separately
    ],

    // Enable globals (describe, it, expect without imports)
    globals: true,

    // CRITICAL: 20-second timeout to prevent test hangs
    testTimeout: 20000,
    hookTimeout: 20000,

    // Coverage configuration
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.{js,jsx,ts,tsx}",
        "app/**/*.{js,jsx,ts,tsx}",
        "packages/ui/src/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
    },

    // ESM module handling for problematic packages
    deps: {
      optimizer: {
        web: {
          include: [
            // ESM-only modules that need transformation
            "react-syntax-highlighter",
            "react-markdown",
            "remark-gfm",
            "remark-parse",
            "remark-rehype",
            "unified",
            "unist-util-visit",
            "micromark",
            "mdast-util-from-markdown",
            "mdast-util-to-hast",
            "mdast-util-gfm",
            "hast-util-to-jsx-runtime",
            "vfile",
            "vfile-message",
            "devlop",
            "bail",
            "trough",
            "decode-named-character-reference",
            "character-entities",
            "property-information",
            "space-separated-tokens",
            "comma-separated-tokens",
            "hast-util-whitespace",
            "trim-lines",
            "ccount",
            "escape-string-regexp",
            "zwitch",
            "html-url-attributes",
            // React icons is ESM-only
            "react-icons",
          ],
        },
      },
    },

    // Server configuration for ESM modules
    server: {
      deps: {
        // Modules that require inline processing for ESM compatibility
        inline: [
          // jsdom dependencies with ESM issues
          "@exodus/bytes",
          "html-encoding-sniffer",
          // ag-grid packages need inline processing for mock compatibility
          "ag-grid-community",
          "ag-grid-react",
        ],
      },
    },
  },
});
