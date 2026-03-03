/**
 * @file handlers.ts
 * @description MSW request handlers for Storybook stories
 *
 * These handlers mock API endpoints used by @datarecce/ui components.
 * They provide realistic mock data for components that depend on API responses.
 *
 * Note: The useModelColumns hook first checks LineageGraphContext for columns
 * before making API calls. If you provide proper mock data via MockLineageProvider,
 * these handlers may not be invoked. They serve as a fallback for stories that
 * don't use MockLineageProvider or for components that always call the API.
 *
 * SETUP REQUIRED:
 * 1. Install MSW: pnpm add -D msw
 * 2. Generate service worker: pnpm exec msw init public/
 * 3. Uncomment the imports and handler code below
 */

import { HttpResponse, http } from "msw";

/**
 * Type definition for model info response
 * Matches ModelInfoResult from @datarecce/ui/api
 */
interface ModelInfoResult {
  model: {
    base: {
      columns?: Record<string, { name: string; type: string }>;
      primary_key?: string;
    };
    current: {
      columns?: Record<string, { name: string; type: string }>;
      primary_key?: string;
    };
  };
}

/**
 * Mock column data for different models
 * This matches the NodeColumnData interface from @datarecce/ui
 */
const mockModelColumns = {
  orders: {
    order_id: { name: "order_id", type: "INTEGER" },
    customer_id: { name: "customer_id", type: "INTEGER" },
    total_amount: { name: "total_amount", type: "DECIMAL" },
    quantity: { name: "quantity", type: "INTEGER" },
    order_date: { name: "order_date", type: "TIMESTAMP" },
    status: { name: "status", type: "VARCHAR" },
  },
  customers: {
    customer_id: { name: "customer_id", type: "INTEGER" },
    name: { name: "name", type: "VARCHAR" },
    email: { name: "email", type: "VARCHAR" },
    age: { name: "age", type: "INTEGER" },
  },
  users: {
    user_id: { name: "user_id", type: "INTEGER" },
    username: { name: "username", type: "VARCHAR" },
    email: { name: "email", type: "VARCHAR" },
    status: { name: "status", type: "VARCHAR" },
    created_at: { name: "created_at", type: "TIMESTAMP" },
  },
};

/**
 * Create a mock ModelInfoResult for a given model
 */
function createModelInfoResponse(
  modelName: string,
): ModelInfoResult | undefined {
  const columns =
    mockModelColumns[modelName as keyof typeof mockModelColumns] ?? undefined;

  if (!columns) {
    return undefined;
  }

  return {
    model: {
      base: {
        columns,
        primary_key: undefined,
      },
      current: {
        columns,
        primary_key: undefined,
      },
    },
  };
}

/**
 * MSW request handlers for Recce API endpoints
 */
export const handlers = [
  // Handler for /api/model/:model endpoint
  // Used by useModelColumns hook when columns aren't available in context
  http.get("/api/model/:model", ({ params }) => {
    const model = params.model as string;
    const response = createModelInfoResponse(model);

    if (!response) {
      return new HttpResponse(
        JSON.stringify({ error: `Model '${model}' not found` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return HttpResponse.json(response);
  }),

  // Handler for /api/info endpoint
  // Used by various components to get server info
  http.get("/api/info", () => {
    return HttpResponse.json({
      state_metadata: {
        schema_version: "1.0.0",
        recce_version: "0.1.0",
        generated_at: new Date().toISOString(),
      },
      adapter_type: "dbt",
      review_mode: false,
      cloud_mode: false,
      file_mode: false,
      demo: false,
      codespace: false,
      support_tasks: {
        row_count_diff: true,
        value_diff: true,
        profile_diff: true,
        histogram_diff: true,
        top_k_diff: true,
      },
      lineage: {
        base: { metadata: { pr_url: "" }, nodes: {}, parent_map: {} },
        current: { metadata: { pr_url: "" }, nodes: {}, parent_map: {} },
        diff: {},
      },
    });
  }),
];

// Export mock data for use in tests or other mocks
export { mockModelColumns, createModelInfoResponse };

export default handlers;
