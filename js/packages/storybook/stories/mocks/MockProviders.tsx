import { LineageGraphProvider } from "@datarecce/ui/contexts";
import type { ReactNode } from "react";

// Mock lineage graph with sample columns
const mockLineageGraph = {
  nodes: {
    orders: {
      id: "orders",
      data: {
        id: "orders",
        unique_id: "model.orders",
        name: "orders",
        resourceType: "model" as const,
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
      position: { x: 0, y: 0 },
    },
    customers: {
      id: "customers",
      data: {
        id: "customers",
        unique_id: "model.customers",
        name: "customers",
        resourceType: "model" as const,
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
      position: { x: 0, y: 0 },
    },
    users: {
      id: "users",
      data: {
        id: "users",
        unique_id: "model.users",
        name: "users",
        resourceType: "model" as const,
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
      position: { x: 0, y: 0 },
    },
  },
  edges: {},
  modifiedSet: new Set(),
  manifestMetadata: {},
  catalogMetadata: {},
};

export function MockLineageProvider({ children }: { children: ReactNode }) {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: Mock data doesn't need full type compliance
    <LineageGraphProvider lineageGraph={mockLineageGraph as any}>
      {children}
    </LineageGraphProvider>
  );
}
