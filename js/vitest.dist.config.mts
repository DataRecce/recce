import { defineConfig } from "vitest/config";

// vitest.config.mts aliases @datarecce/ui to source, so a test under it can
// never reach the built output.
export default defineConfig({
  test: {
    environment: "happy-dom",
    // Node.js 26's server-side localStorage shadows happy-dom without this.
    execArgv: ["--no-experimental-webstorage"],
    include: ["packages/ui/__smoke__/**/*.test.ts"],
  },
});
