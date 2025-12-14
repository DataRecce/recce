"use client";

import type { DividerProps } from "@mui/material/Divider";
import MuiDivider from "@mui/material/Divider";
import type { MenuProps as MuiMenuProps } from "@mui/material/Menu";
import MuiMenu from "@mui/material/Menu";
import type { MenuItemProps as MuiMenuItemProps } from "@mui/material/MenuItem";
import MuiMenuItem from "@mui/material/MenuItem";
import {
  forwardRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";

/**
 * Menu Components - MUI equivalent of Chakra's Menu compound components
 */

// Menu Root - Container that manages menu state
export interface MenuRootProps {
  children?: ReactNode;
  /** Controlled open state (for external control) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (details: { open: boolean }) => void;
  /** Menu size */
  size?: "sm" | "md" | "lg";
  /** Lazy mount - render content only when open */
  lazyMount?: boolean;
  /** Close menu on item select */
  closeOnSelect?: boolean;
  /** Positioning configuration */
  positioning?: {
    placement?:
      | "bottom-start"
      | "bottom-end"
      | "top-start"
      | "top-end"
      | "bottom"
      | "top";
    /** Custom anchor rect getter (Chakra compatibility) */
    getAnchorRect?: () => DOMRect | null;
  };
}

export const MenuRoot = forwardRef<HTMLDivElement, MenuRootProps>(
  function MenuRoot(
    {
      children,
      positioning,
      open: controlledOpen,
      onOpenChange,
      size: _size,
      lazyMount: _lazyMount,
      closeOnSelect = true,
    },
    ref,
  ) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [internalOpen, setInternalOpen] = useState(false);

    // Use controlled state if provided, otherwise use internal state
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const handleOpen = (event: MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
      if (!isControlled) {
        setInternalOpen(true);
      }
      onOpenChange?.({ open: true });
    };

    const handleClose = () => {
      setAnchorEl(null);
      if (!isControlled) {
        setInternalOpen(false);
      }
      onOpenChange?.({ open: false });
    };

    // Clone children and inject menu context
    const childrenArray = Array.isArray(children) ? children : [children];
    const enhancedChildren = childrenArray.map((child, index) => {
      if (!child) return null;
      const childElement = child as ReactElement<{
        anchorEl?: HTMLElement | null;
        open?: boolean;
        onOpen?: (event: MouseEvent<HTMLElement>) => void;
        onClose?: () => void;
        positioning?: MenuRootProps["positioning"];
        children?: ReactNode;
      }>;

      if (childElement.type === MenuTrigger) {
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: compound component children have stable order
          <MenuTrigger key={index} onOpen={handleOpen}>
            {childElement.props.children}
          </MenuTrigger>
        );
      }
      if (childElement.type === MenuContent) {
        return (
          <MenuContent
            // biome-ignore lint/suspicious/noArrayIndexKey: compound component children have stable order
            key={index}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
            positioning={positioning}
          >
            {childElement.props.children}
          </MenuContent>
        );
      }
      return child;
    });

    return <div ref={ref}>{enhancedChildren}</div>;
  },
);

// Menu Trigger - Element that opens the menu
export interface MenuTriggerProps {
  children?: ReactNode;
  onOpen?: (event: MouseEvent<HTMLElement>) => void;
  asChild?: boolean;
}

export const MenuTrigger = forwardRef<HTMLDivElement, MenuTriggerProps>(
  function MenuTrigger({ children, onOpen }, ref) {
    const handleClick = (event: MouseEvent<HTMLElement>) => {
      onOpen?.(event);
    };

    return (
      <div
        ref={ref}
        onClick={handleClick}
        style={{ display: "inline-block", cursor: "pointer" }}
      >
        {children}
      </div>
    );
  },
);

// Menu Positioner - Wrapper for positioning (API compatibility)
interface MenuPositionerProps {
  children?: ReactNode;
}

function MenuPositioner({ children }: MenuPositionerProps) {
  // MUI handles positioning internally, this is for API compatibility
  return <>{children}</>;
}

// Menu Content - The dropdown menu itself
export interface MenuContentProps extends Omit<MuiMenuProps, "ref" | "open"> {
  children?: ReactNode;
  open?: boolean;
  positioning?: MenuRootProps["positioning"];
  /** Background color */
  bg?: string;
  /** Border color */
  borderColor?: string;
  /** Box shadow */
  boxShadow?: string;
  /** Minimum width */
  minW?: string;
  /** Font size */
  fontSize?: string;
  /** Position */
  position?: string;
  /** Width */
  width?: string | number;
  /** Z-index */
  zIndex?: string | number;
  /** Class name */
  className?: string;
}

const placementToAnchorOrigin: Record<string, MuiMenuProps["anchorOrigin"]> = {
  "bottom-start": { vertical: "bottom", horizontal: "left" },
  "bottom-end": { vertical: "bottom", horizontal: "right" },
  "top-start": { vertical: "top", horizontal: "left" },
  "top-end": { vertical: "top", horizontal: "right" },
  bottom: { vertical: "bottom", horizontal: "center" },
  top: { vertical: "top", horizontal: "center" },
};

export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(
  function MenuContent(
    {
      children,
      open = false,
      positioning,
      anchorEl,
      onClose,
      bg,
      borderColor,
      boxShadow,
      minW,
      fontSize,
      position,
      width,
      zIndex,
      className,
      sx,
      ...props
    },
    ref,
  ) {
    const anchorOrigin =
      placementToAnchorOrigin[positioning?.placement || "bottom-start"];

    return (
      <MuiMenu
        ref={ref}
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={anchorOrigin}
        className={className}
        sx={{
          ...(zIndex !== undefined && { zIndex }),
          "& .MuiPaper-root": {
            ...(bg && { backgroundColor: bg }),
            ...(borderColor && { borderColor }),
            ...(boxShadow && { boxShadow }),
            ...(minW && { minWidth: minW }),
            ...(fontSize && { fontSize }),
            ...(position && { position }),
            ...(width && { width }),
          },
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiMenu>
    );
  },
);

// Menu Item
export interface MenuItemProps extends Omit<MuiMenuItemProps, "ref"> {
  children?: ReactNode;
  /** Value for the menu item */
  value?: string;
}

export const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
  function MenuItem({ children, ...props }, ref) {
    return (
      <MuiMenuItem ref={ref} {...props}>
        {children}
      </MuiMenuItem>
    );
  },
);

// Menu Separator
export interface MenuSeparatorProps extends Omit<DividerProps, "ref"> {}

export const MenuSeparator = forwardRef<HTMLHRElement, MenuSeparatorProps>(
  function MenuSeparator(props, ref) {
    return <MuiDivider ref={ref} {...props} />;
  },
);

// Menu Item Group - Groups related menu items
export interface MenuItemGroupProps {
  children?: ReactNode;
}

function MenuItemGroup({ children }: MenuItemGroupProps) {
  return <>{children}</>;
}

// Combined Menu namespace for Chakra-like usage
export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Positioner: MenuPositioner,
  Content: MenuContent,
  Item: MenuItem,
  ItemGroup: MenuItemGroup,
  Separator: MenuSeparator,
};

export default Menu;
