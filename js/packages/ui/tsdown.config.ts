import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    advanced: "src/advanced.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,

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
