const { join } = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: join(__dirname),
  output: "export",
  trailingSlash: true,
  experimental: {
    // Next 16.3 defaults to the TypeScript CLI, but the `typescript` alias in
    // this workspace intentionally provides the TypeScript 6 compiler API.
    useTypeScriptCli: false,
  },
  env: {
    AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
    GTM_ID: process.env.GTM_ID,
  },
  // Transpile ESM packages that have issues with Turbopack
  transpilePackages: ["html2canvas-pro"],
};

module.exports = nextConfig;
