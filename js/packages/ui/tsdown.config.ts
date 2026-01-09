import path from "path";
import { defineConfig } from "tsdown";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: {
    index: "src/index.ts",
    api: "src/api.ts",
    primitives: "src/primitives.ts",
    advanced: "src/advanced.ts",
    contexts: "src/contexts-entry.ts",
    result: "src/result.ts",
    theme: "src/theme/index.ts",
    types: "src/types/index.ts",
    utils: "src/utils/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,

  // Path aliases for importing from the main js/src directory
  alias: {
    "@ui": path.resolve(__dirname, "./src"),
  },

  external: [
    "react",
    "react-dom",
    /^@emotion\//,
    /^@mui\//,
    "@tanstack/react-query",
    "@xyflow/react",
    "next-themes",
    "axios",
  ],

  // Bundle these to ensure consistent versions
  noExternal: ["html-to-image", /^html2canvas-pro/],

  banner: {
    js: '"use client";',
  },

  // CSS handled separately by Tailwind build pipeline
  loader: {
    ".css": "empty",
  },
});
