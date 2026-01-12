/**
 * @file useModelColumns.tsx
 * @description Re-export from @datarecce/ui for backwards compatibility.
 * The canonical implementation is now in the @datarecce/ui package.
 */

// Re-export everything from @datarecce/ui
// Default export for backwards compatibility
export {
  extractColumns,
  type UseModelColumnsReturn,
  unionColumns,
  useModelColumns,
  useModelColumns as default,
} from "@datarecce/ui/hooks";
