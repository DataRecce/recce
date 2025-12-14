"use client";

import type { ListProps as MuiListProps } from "@mui/material/List";
import MuiList from "@mui/material/List";
import type { ListItemProps as MuiListItemProps } from "@mui/material/ListItem";
import MuiListItem from "@mui/material/ListItem";
import MuiListItemIcon from "@mui/material/ListItemIcon";
import MuiListItemText from "@mui/material/ListItemText";
import { forwardRef, type ReactNode } from "react";

/**
 * List Component - MUI equivalent of Chakra's List
 *
 * A list component for displaying items.
 */

export interface ListProps extends Omit<MuiListProps, "ref"> {
  /** Spacing between items */
  spacing?: number;
  /** Whether to use ordered list styling */
  ordered?: boolean;
  /** Padding start (logical padding-left in LTR) */
  ps?: string | number;
  /** Overflow */
  overflow?: string;
  /** Background color */
  backgroundColor?: string;
  /** Render as element type */
  as?: React.ElementType;
  /** List style */
  listStyle?: string;
}

export interface ListItemProps extends Omit<MuiListItemProps, "ref"> {
  /** Icon to display before the item */
  icon?: ReactNode;
  /** Children content */
  children?: ReactNode;
  /** Margin left */
  ml?: string | number;
}

const ListBase = forwardRef<HTMLUListElement, ListProps>(function List(
  { spacing, ordered, ps, overflow, backgroundColor, as, listStyle, sx, ...props },
  ref,
) {
  // Determine component type: explicit 'as' > ordered > default ul
  const component = as || (ordered ? "ol" : "ul");

  return (
    <MuiList
      ref={ref}
      component={component}
      sx={{
        ...(spacing && {
          "& > li": {
            marginBottom: spacing,
          },
        }),
        ...(ps !== undefined && { paddingInlineStart: ps }),
        ...(overflow && { overflow }),
        ...(backgroundColor && { backgroundColor }),
        ...(listStyle && { listStyle }),
        ...sx,
      }}
      {...props}
    />
  );
});

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  function ListItem({ icon, children, ml, sx, ...props }, ref) {
    const styles = {
      ...(ml !== undefined && { ml }),
      ...sx,
    };

    if (icon) {
      return (
        <MuiListItem ref={ref} sx={styles} {...props}>
          <MuiListItemIcon>{icon}</MuiListItemIcon>
          {typeof children === "string" ? (
            <MuiListItemText primary={children} />
          ) : (
            children
          )}
        </MuiListItem>
      );
    }

    return (
      <MuiListItem ref={ref} sx={styles} {...props}>
        {typeof children === "string" ? (
          <MuiListItemText primary={children} />
        ) : (
          children
        )}
      </MuiListItem>
    );
  },
);

// Re-exports
export { MuiListItemIcon as ListIcon, MuiListItemText as ListItemText };

// Compound component with proper typing
type ListWithCompound = typeof ListBase & {
  Root: typeof ListBase;
  Item: typeof ListItem;
};

// Create compound component
export const List = Object.assign(ListBase, {
  Root: ListBase,
  Item: ListItem,
}) as ListWithCompound;

export default List;
