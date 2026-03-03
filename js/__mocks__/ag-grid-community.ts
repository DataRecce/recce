/**
 * @file Mock for ag-grid-community
 * This mock provides the minimum exports needed to avoid ESM loading issues
 * during Vitest test runs.
 */

// Mock themeQuartz with withParams method that returns a mock theme
export const themeQuartz = {
  withParams: () => "mocked-theme",
};

// Mock AllCommunityModule
export const AllCommunityModule = {};

// Mock ModuleRegistry
export const ModuleRegistry = {
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op mock
  registerModules: () => {},
};

// Type exports - these are just type definitions, export as empty interfaces
export interface ColDef<_TData = unknown> {
  field?: string;
  headerName?: string;
  [key: string]: unknown;
}

export interface ColGroupDef<TData = unknown> {
  headerName?: string;
  children?: (ColDef<TData> | ColGroupDef<TData>)[];
  [key: string]: unknown;
}

export interface GetRowIdParams<TData = unknown> {
  data: TData;
  [key: string]: unknown;
}

export interface GridReadyEvent<_TData = unknown> {
  api: unknown;
  [key: string]: unknown;
}

export interface GridApi<_TData = unknown> {
  [key: string]: unknown;
}

export interface ICellRendererParams<TData = unknown> {
  value?: unknown;
  data?: TData;
  [key: string]: unknown;
}

export interface ValueGetterParams<TData = unknown> {
  data?: TData;
  [key: string]: unknown;
}

export interface ValueFormatterParams<TData = unknown> {
  value?: unknown;
  data?: TData;
  [key: string]: unknown;
}

// Additional commonly used exports
export interface RowClassParams<TData = unknown> {
  data?: TData;
  [key: string]: unknown;
}

export interface CellClassParams<TData = unknown> {
  value?: unknown;
  data?: TData;
  [key: string]: unknown;
}
