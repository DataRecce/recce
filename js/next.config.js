/** @type {import('next').NextConfig} */
const nextConfig = {
   output: 'export',
   env: {
      AMPLITUDE_API_KEY: process.env.AMPLITUDE_API_KEY,
   }
}

module.exports = nextConfig
