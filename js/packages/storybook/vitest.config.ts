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
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./.storybook/vitest.setup.ts"],
    include: ["stories/**/*.test.{ts,tsx}"],
    exclude: ["node_modules"],
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
