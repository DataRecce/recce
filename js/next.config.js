const { join } = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: join(__dirname),
  output: "export",
  env: {
    AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
    GTM_ID: process.env.GTM_ID,
  },
};

module.exports = nextConfig;
