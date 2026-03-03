/**
 * @file Mock for ag-grid-react
 * This mock provides the AgGridReact component as a no-op for testing.
 */

import React, { forwardRef } from "react";

// Mock AgGridReact component
export const AgGridReact = forwardRef(function MockAgGridReact(
  props: Record<string, unknown>,
  ref: React.Ref<unknown>,
) {
  return React.createElement("div", {
    "data-testid": "ag-grid-mock",
    ref,
    ...props,
  });
});

// Re-export types as empty objects/types
export interface AgGridReactProps<TData = unknown> {
  rowData?: TData[];
  columnDefs?: unknown[];
  [key: string]: unknown;
}
