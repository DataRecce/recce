## Prerequisites

1. Node (>18)
   ```
   nvm use 20
   ```
2. pnpm

   ```
   npm install -g pnpm
   ```

## Development

1. Run the python server

   ```bash
   cd my-dbt-project/
   piti server
   ```

   The api server is run at http://localhost:8000/api

2. Run the dev server

   ```bash
   pnpm dev
   ```

## Build

```bash
pnpm build
cd ../piti/data
git add .
```
