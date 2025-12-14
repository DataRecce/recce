"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import type { TableProps as MuiTableProps } from "@mui/material/Table";
import MuiTable from "@mui/material/Table";
import type { TableBodyProps as MuiTableBodyProps } from "@mui/material/TableBody";
import MuiTableBody from "@mui/material/TableBody";
import type { TableCellProps as MuiTableCellProps } from "@mui/material/TableCell";
import MuiTableCell from "@mui/material/TableCell";
import type { TableContainerProps as MuiTableContainerProps } from "@mui/material/TableContainer";
import MuiTableContainer from "@mui/material/TableContainer";
import type { TableHeadProps as MuiTableHeadProps } from "@mui/material/TableHead";
import MuiTableHead from "@mui/material/TableHead";
import type { TableRowProps as MuiTableRowProps } from "@mui/material/TableRow";
import MuiTableRow from "@mui/material/TableRow";
import { forwardRef, type ReactNode } from "react";

/**
 * Table Component - MUI equivalent of Chakra's Table
 *
 * A compound table component with Chakra-compatible props.
 */

// Size mapping from Chakra to MUI
const sizeToMui: Record<string, MuiTableProps["size"]> = {
  sm: "small",
  md: "medium",
  lg: "medium",
};

// Root Table component
export interface TableRootProps extends Omit<MuiTableProps, "ref" | "size"> {
  /** Size of the table - Chakra sizes map to MUI */
  size?: "sm" | "md" | "lg" | "small" | "medium";
  /** Chakra variant (line, striped) - maps to styling */
  variant?: "line" | "striped" | "simple";
  /** Whether to use sticky header */
  stickyHeader?: boolean;
}

const TableRoot = forwardRef<HTMLTableElement, TableRootProps>(
  function TableRoot(
    { size = "md", variant, stickyHeader, sx, ...props },
    ref,
  ) {
    const muiSize = sizeToMui[size] || size;
    return (
      <MuiTable
        ref={ref}
        size={muiSize as MuiTableProps["size"]}
        stickyHeader={stickyHeader}
        sx={{
          ...(variant === "line" && {
            "& td, & th": { borderBottom: "1px solid", borderColor: "divider" },
          }),
          ...(variant === "striped" && {
            "& tbody tr:nth-of-type(odd)": { bgcolor: "action.hover" },
          }),
          ...sx,
        }}
        {...props}
      />
    );
  },
);

// Header component
export interface TableHeaderProps extends Omit<MuiTableHeadProps, "ref"> {}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  function TableHeader(props, ref) {
    return <MuiTableHead ref={ref} {...props} />;
  },
);

// Body component
export interface TableBodyProps extends Omit<MuiTableBodyProps, "ref"> {}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  function TableBody(props, ref) {
    return <MuiTableBody ref={ref} {...props} />;
  },
);

// Row component
export interface TableRowProps extends Omit<MuiTableRowProps, "ref"> {}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  function TableRow(props, ref) {
    return <MuiTableRow ref={ref} {...props} />;
  },
);

// Cell component
export interface TableCellProps extends Omit<MuiTableCellProps, "ref"> {}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  function TableCell(props, ref) {
    return <MuiTableCell ref={ref} {...props} />;
  },
);

// Column Header (alias for Cell in header context)
export interface TableColumnHeaderProps
  extends Omit<MuiTableCellProps, "ref"> {}

const TableColumnHeader = forwardRef<
  HTMLTableCellElement,
  TableColumnHeaderProps
>(function TableColumnHeader(props, ref) {
  return <MuiTableCell ref={ref} component="th" {...props} />;
});

// ScrollArea - wrapper with overflow scroll
export interface TableScrollAreaProps
  extends Omit<MuiTableContainerProps, "ref"> {
  /** Border width */
  borderWidth?: string;
  /** Height of the scroll area */
  height?: string | number;
  children?: ReactNode;
}

const TableScrollArea = forwardRef<HTMLDivElement, TableScrollAreaProps>(
  function TableScrollArea(
    { borderWidth, height, sx, children, ...props },
    ref,
  ) {
    return (
      <MuiTableContainer
        ref={ref}
        sx={{
          maxHeight: height,
          overflow: "auto",
          ...(borderWidth && {
            border: `${borderWidth} solid`,
            borderColor: "divider",
          }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiTableContainer>
    );
  },
);

// Compound component export
export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  ColumnHeader: TableColumnHeader,
  ScrollArea: TableScrollArea,
};

// Direct exports
export {
  TableRoot,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  TableScrollArea,
};

export default Table;
