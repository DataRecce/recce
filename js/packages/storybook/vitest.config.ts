import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@datarecce/ui/primitives": path.resolve(
        __dirname,
        "../ui/src/primitives.ts",
      ),
      "@datarecce/ui": path.resolve(__dirname, "../ui/src/index.ts"),
      // Fix for html2canvas-pro strict exports in Vite 7.x
      "html2canvas-pro/dist/html2canvas-pro.esm.js": "html2canvas-pro",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./.storybook/vitest.setup.ts"],
    include: ["stories/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
    globals: true,
    deps: {
      optimizer: {
        web: {
          include: ["react-syntax-highlighter"],
        },
      },
    },
  },
});
