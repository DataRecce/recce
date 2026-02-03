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
    hooks: "src/hooks/index.ts",
    result: "src/result.ts",
    theme: "src/theme/index.ts",
    types: "src/types/index.ts",
    utils: "src/utils/index.ts",
    constants: "src/constants/index.ts",
    components: "src/components/index.ts",
    "components-run": "src/components/run/index.ts",
    "lib/const": "src/lib/const.ts",
    "lib/result/ResultErrorFallback": "src/lib/result/ResultErrorFallback.tsx",
    "lib/api/track": "src/lib/api/track.ts",
    "lib/api/user": "src/lib/api/user.ts",
    "lib/api/axiosClient": "src/lib/api/axiosClient.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  platform: "browser",

  // Path aliases for importing from the main js/src directory
  alias: {
    "@ui": path.resolve(__dirname, "./src"),
  },

  external: [
    // Node.js built-ins - prevent CJS interop shim
    /^node:/,
    "react",
    "react-dom",
    /^@emotion\//,
    /^@mui\//,
    "@tanstack/react-query",
    "@xyflow/react",
    "next-themes",
    "axios",
    // Amplitude packages contain Node.js-specific code (node:module)
    // and must be provided by the consuming application
    /^@amplitude\//,
    // react-split uses split.js for resizable panes
    "react-split",
    "split.js",
    // html-to-image and html2canvas-pro are used for screenshot functionality
    "html-to-image",
    "html2canvas-pro",
    // Utility packages - externalize to prevent CJS interop issues
    "js-cookie",
    "file-saver",
    "lodash",
    /^lodash\//,
    "date-fns",
    /^date-fns\//,
    "react-icons",
    /^react-icons\//,
    "usehooks-ts",
    // yaml package uses process.env which requires Node.js
    "yaml",
    // Next.js packages are provided by the consuming application
    /^next\//,
    "next",
    // CodeMirror packages
    /^@codemirror\//,
    // react-markdown and remark/unified ecosystem use Node.js built-ins (vfile uses path, process, url)
    "react-markdown",
    /^remark-/,
    "react-syntax-highlighter",
    /^react-syntax-highlighter\//,
    // vfile and unified ecosystem packages
    /^vfile/,
    /^unified/,
    // react-redux and its dependencies have CJS code
    "react-redux",
    /^react-redux\//,
    "use-sync-external-store",
    /^use-sync-external-store\//,
    "redux",
    /^redux\//,
    "@reduxjs/toolkit",
    /^@reduxjs\//,
  ],

  banner: {
    js: '"use client";',
  },

  // CSS handled separately by Tailwind build pipeline
  loader: {
    ".css": "empty",
  },
});
