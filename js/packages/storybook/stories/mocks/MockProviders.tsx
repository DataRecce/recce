import { LineageGraphProvider } from "@datarecce/ui/contexts";
import type { ReactNode } from "react";

/**
 * Mock lineage graph with sample columns for Storybook stories.
 *
 * This mock provides properly structured LineageGraphNode objects that
 * work with the useModelColumns hook. Each node must have:
 * - type: "lineageGraphNode" (required for React Flow)
 * - position: { x, y } (required for React Flow)
 * - data.name: model name (used by useModelColumns to find the node)
 * - data.from: "both" | "base" | "current"
 * - data.data.base/current.columns: column definitions
 * - data.parents/children: edge relationships
 */
const mockLineageGraph = {
  nodes: {
    orders: {
      id: "orders",
      type: "lineageGraphNode" as const,
      position: { x: 0, y: 0 },
      data: {
        id: "orders",
        name: "orders",
        from: "both" as const,
        resourceType: "model",
        parents: {},
        children: {},
        data: {
          base: {
            id: "orders",
            unique_id: "model.orders",
            name: "orders",
            columns: {
              order_id: { name: "order_id", type: "INTEGER" },
              customer_id: { name: "customer_id", type: "INTEGER" },
              total_amount: { name: "total_amount", type: "DECIMAL" },
              quantity: { name: "quantity", type: "INTEGER" },
              order_date: { name: "order_date", type: "TIMESTAMP" },
              status: { name: "status", type: "VARCHAR" },
            },
          },
          current: {
            id: "orders",
            unique_id: "model.orders",
            name: "orders",
            columns: {
              order_id: { name: "order_id", type: "INTEGER" },
              customer_id: { name: "customer_id", type: "INTEGER" },
              total_amount: { name: "total_amount", type: "DECIMAL" },
              quantity: { name: "quantity", type: "INTEGER" },
              order_date: { name: "order_date", type: "TIMESTAMP" },
              status: { name: "status", type: "VARCHAR" },
            },
          },
        },
      },
    },
    customers: {
      id: "customers",
      type: "lineageGraphNode" as const,
      position: { x: 0, y: 0 },
      data: {
        id: "customers",
        name: "customers",
        from: "both" as const,
        resourceType: "model",
        parents: {},
        children: {},
        data: {
          base: {
            id: "customers",
            unique_id: "model.customers",
            name: "customers",
            columns: {
              customer_id: { name: "customer_id", type: "INTEGER" },
              name: { name: "name", type: "VARCHAR" },
              email: { name: "email", type: "VARCHAR" },
              age: { name: "age", type: "INTEGER" },
            },
          },
          current: {
            id: "customers",
            unique_id: "model.customers",
            name: "customers",
            columns: {
              customer_id: { name: "customer_id", type: "INTEGER" },
              name: { name: "name", type: "VARCHAR" },
              email: { name: "email", type: "VARCHAR" },
              age: { name: "age", type: "INTEGER" },
            },
          },
        },
      },
    },
    users: {
      id: "users",
      type: "lineageGraphNode" as const,
      position: { x: 0, y: 0 },
      data: {
        id: "users",
        name: "users",
        from: "both" as const,
        resourceType: "model",
        parents: {},
        children: {},
        data: {
          base: {
            id: "users",
            unique_id: "model.users",
            name: "users",
            columns: {
              user_id: { name: "user_id", type: "INTEGER" },
              username: { name: "username", type: "VARCHAR" },
              email: { name: "email", type: "VARCHAR" },
              status: { name: "status", type: "VARCHAR" },
              created_at: { name: "created_at", type: "TIMESTAMP" },
            },
          },
          current: {
            id: "users",
            unique_id: "model.users",
            name: "users",
            columns: {
              user_id: { name: "user_id", type: "INTEGER" },
              username: { name: "username", type: "VARCHAR" },
              email: { name: "email", type: "VARCHAR" },
              status: { name: "status", type: "VARCHAR" },
              created_at: { name: "created_at", type: "TIMESTAMP" },
            },
          },
        },
      },
    },
  },
  edges: {},
  modifiedSet: [],
  manifestMetadata: {
    base: undefined,
    current: undefined,
  },
  catalogMetadata: {
    base: undefined,
    current: undefined,
  },
};

export function MockLineageProvider({ children }: { children: ReactNode }) {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: Mock data doesn't need full type compliance
    <LineageGraphProvider lineageGraph={mockLineageGraph as any}>
      {children}
    </LineageGraphProvider>
  );
}
