import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscPin, VscPinned } from "react-icons/vsc";
import { Menu, Portal } from "@/components/ui/mui";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";
import { ColumnRenderMode, ColumnType } from "@/lib/api/types";

/**
 * Props for the DataFrameColumnHeader component
 */
export interface DataFrameColumnHeaderProps {
  /** Column name to display */
  name: string;
  /** Column data type for determining available options */
  columnType: ColumnType;
  /** List of currently pinned column names */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  /** Callback when column render mode changes */
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

export function DataFrameColumnHeader({
  name,
  pinnedColumns = [],
  onPinnedColumnsChange = () => {
    return void 0;
  },
  columnType,
  onColumnsRenderModeChanged,
}: DataFrameColumnHeaderProps) {
  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  const isPinned = pinnedColumns.includes(name);

  const handleUnpin = () => {
    const newPinnedColumns = pinnedColumns.filter((item) => item !== name);
    onPinnedColumnsChange(newPinnedColumns);
  };

  const handlePin = () => {
    const newPinnedColumns = [...pinnedColumns, name];
    onPinnedColumnsChange(newPinnedColumns);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center" }} className="grid-header">
      <Box sx={{ flex: 1 }}>{name}</Box>

      <Box
        component={isPinned ? VscPinned : VscPin}
        className={isPinned ? "unpin-icon" : "pin-icon"}
        sx={{
          display: isPinned ? "block" : "none",
          cursor: "pointer",
        }}
        onClick={isPinned ? handleUnpin : handlePin}
      />
      {columnType === "number" && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Options"
              size="small"
              className="!size-4 !min-w-4"
            >
              <PiDotsThreeVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {selectOptions.map((o) => (
                  <Menu.Item key={o.value} value={o.value} onClick={o.onClick}>
                    {o.value}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Box>
  );
}
