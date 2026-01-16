import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-docs")],

  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },

  viteFinal: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@datarecce/ui/styles": resolve(
        __dirname,
        "../../ui/src/styles/index.ts",
      ),
      "@datarecce/ui/primitives": resolve(
        __dirname,
        "../../ui/src/primitives.ts",
      ),
      "@datarecce/ui": resolve(__dirname, "../../ui/src/index.ts"),
      // Fix for html2canvas-pro strict exports in Vite 7.x
      "html2canvas-pro/dist/html2canvas-pro.esm.js": "html2canvas-pro",
    };

    // Polyfill Node.js globals for browser (Next.js uses process.env)
    config.define = {
      ...config.define,
      "process.env": {},
    };

    return config;
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
