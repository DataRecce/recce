import type { EnvInfo, LineageGraph } from "@datarecce/ui";

/**
 * Create a mock EnvInfo fixture with sensible defaults
 * Note: GitInfo only has branch field per API type definition
 */
export const createEnvInfo = (overrides: Partial<EnvInfo> = {}): EnvInfo => ({
  adapterType: "dbt",
  git: {
    branch: "feature/my-branch",
  },
  pullRequest: {
    id: "123",
    title: "Add new analytics model",
    url: "https://github.com/myorg/myrepo/pull/123",
  },
  dbt: {
    base: {
      dbt_version: "1.7.0",
      dbt_schema_version: "1.0.0",
      adapter_type: "postgres",
      env: {},
      invocation_id: "base-invocation-123",
      generated_at: new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 14 days ago
    },
    current: {
      dbt_version: "1.7.1",
      dbt_schema_version: "1.0.0",
      adapter_type: "postgres",
      env: {},
      invocation_id: "current-invocation-456",
      generated_at: new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString(), // 1 day ago
    },
  },
  ...overrides,
});

/**
 * Create a mock LineageGraph fixture with sample nodes
 */
export const createLineageGraph = (
  overrides: Partial<LineageGraph> = {},
): LineageGraph => ({
  nodes: {
    "model.myproject.customers": {
      id: "model.myproject.customers",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.myproject.customers",
        name: "customers",
        from: "both",
        data: {
          base: {
            id: "model.myproject.customers",
            unique_id: "model.myproject.customers",
            name: "customers",
            schema: "analytics",
          },
          current: {
            id: "model.myproject.customers",
            unique_id: "model.myproject.customers",
            name: "customers",
            schema: "analytics",
          },
        },
        resourceType: "model",
        packageName: "myproject",
        parents: {},
        children: {},
      },
    },
    "model.myproject.orders": {
      id: "model.myproject.orders",
      type: "lineageGraphNode",
      position: { x: 0, y: 0 },
      data: {
        id: "model.myproject.orders",
        name: "orders",
        from: "both",
        data: {
          base: {
            id: "model.myproject.orders",
            unique_id: "model.myproject.orders",
            name: "orders",
            schema: "staging",
          },
          current: {
            id: "model.myproject.orders",
            unique_id: "model.myproject.orders",
            name: "orders",
            schema: "analytics",
          },
        },
        resourceType: "model",
        packageName: "myproject",
        parents: {},
        children: {},
      },
    },
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: { base: undefined, current: undefined },
  catalogMetadata: { base: undefined, current: undefined },
  ...overrides,
});

/**
 * SQLMesh-specific EnvInfo
 */
export const createSqlMeshEnvInfo = (
  overrides: Partial<EnvInfo> = {},
): EnvInfo => ({
  adapterType: "sqlmesh",
  git: {
    branch: "main",
  },
  sqlmesh: {
    base_env: "prod",
    current_env: "dev",
  },
  ...overrides,
});

/**
 * Minimal EnvInfo with only git info (no DBT/SQLMesh)
 */
export const createMinimalEnvInfo = (
  overrides: Partial<EnvInfo> = {},
): EnvInfo => ({
  git: {
    branch: "main",
  },
  ...overrides,
});
