import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./.storybook/vitest.setup.ts"],
    include: ["stories/**/*.test.{ts,tsx}"],
    exclude: ["node_modules"],
    globals: true,
  },
});
