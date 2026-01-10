/**
 * @file index.ts
 * @description Barrel export for OSS-specific DataGrid components
 *
 * Most components are now exported from @datarecce/ui/components/ui.
 * This file only exports the OSS-specific inlineRenderCell which uses
 * the OSS DiffText component with toast notifications.
 *
 * For standard components, import from @datarecce/ui/components/ui:
 * - DataFrameColumnGroupHeader
 * - DataFrameColumnHeader
 * - defaultRenderCell
 *
 * NOTE: valueDiffCells.tsx and schemaCells.tsx are NOT exported here.
 * Those components use hooks that pull in heavy dependencies.
 * Import them directly when needed.
 */

export { asNumber, inlineRenderCell } from "./inlineRenderCell";
