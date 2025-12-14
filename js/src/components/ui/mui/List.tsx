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
}

export interface ListItemProps extends Omit<MuiListItemProps, "ref"> {
  /** Icon to display before the item */
  icon?: ReactNode;
  /** Children content */
  children?: ReactNode;
}

export const List = forwardRef<HTMLUListElement, ListProps>(function List(
  { spacing, ordered, sx, ...props },
  ref,
) {
  return (
    <MuiList
      ref={ref}
      component={ordered ? "ol" : "ul"}
      sx={{
        ...(spacing && {
          "& > li": {
            marginBottom: spacing,
          },
        }),
        ...sx,
      }}
      {...props}
    />
  );
});

export const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  function ListItem({ icon, children, ...props }, ref) {
    if (icon) {
      return (
        <MuiListItem ref={ref} {...props}>
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
      <MuiListItem ref={ref} {...props}>
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

export default List;
