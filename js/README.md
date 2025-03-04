## Prerequisites

1. Node (>18)
   ```
   nvm use 20
   ```
2. pnpm

   ```
   npm install -g corepack@latest
   corepack enable
   corepack install
   pnpm install
   ```

## Development

1. Run the python server

   ```bash
   cd my-dbt-project/
   recce server
   ```

   The api server is run at http://localhost:8000/api

2. Run the dev server

   ```bash
   pnpm dev
   ```

## Build

```bash
pnpm build
cd ../recce/data
git add .
```
