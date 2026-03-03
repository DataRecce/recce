const { join } = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: join(__dirname),
  output: "export",
  trailingSlash: true,
  env: {
    AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
    GTM_ID: process.env.GTM_ID,
  },
  // Transpile ESM packages that have issues with Turbopack
  transpilePackages: ["html2canvas-pro"],
};

module.exports = nextConfig;
