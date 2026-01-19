import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@datarecce/ui/styles": path.resolve(
        __dirname,
        "../ui/src/styles/index.ts",
      ),
      "@datarecce/ui/primitives": path.resolve(
        __dirname,
        "../ui/src/primitives.ts",
      ),
      "@datarecce/ui/components": path.resolve(
        __dirname,
        "../ui/src/components/index.ts",
      ),
      "@datarecce/ui/contexts": path.resolve(
        __dirname,
        "../ui/src/contexts/index.ts",
      ),
      "@datarecce/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      // Fix for html2canvas-pro strict exports in Vite 7.x
      "html2canvas-pro/dist/html2canvas-pro.esm.js": "html2canvas-pro",
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./.storybook/vitest.setup.ts"],
    exclude: ["node_modules", "dist"],
    globals: true,
    deps: {
      optimizer: {
        web: {
          include: ["react-syntax-highlighter"],
        },
      },
    },
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
});
