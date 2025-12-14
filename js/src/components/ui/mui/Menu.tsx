"use client";

import type { DividerProps } from "@mui/material/Divider";
import MuiDivider from "@mui/material/Divider";
import type { MenuProps as MuiMenuProps } from "@mui/material/Menu";
import MuiMenu from "@mui/material/Menu";
import type { MenuItemProps as MuiMenuItemProps } from "@mui/material/MenuItem";
import MuiMenuItem from "@mui/material/MenuItem";
import {
  createContext,
  forwardRef,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";

/**
 * Menu Components - MUI equivalent of Chakra's Menu compound components
 *
 * Uses React Context to pass state between compound components,
 * allowing Portal to be used between Menu.Root and Menu.Content.
 */

// Menu Context for sharing state between compound components
interface MenuContextValue {
  anchorEl: HTMLElement | null;
  open: boolean;
  handleOpen: (event: MouseEvent<HTMLElement>) => void;
  handleClose: () => void;
  positioning?: MenuRootProps["positioning"];
  closeOnSelect: boolean;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("Menu components must be used within Menu.Root");
  }
  return context;
}

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

    const contextValue: MenuContextValue = {
      anchorEl,
      open,
      handleOpen,
      handleClose,
      positioning,
      closeOnSelect,
    };

    return (
      <MenuContext.Provider value={contextValue}>
        <div ref={ref}>{children}</div>
      </MenuContext.Provider>
    );
  },
);

// Menu Trigger - Element that opens the menu
export interface MenuTriggerProps {
  children?: ReactNode;
  onOpen?: (event: MouseEvent<HTMLElement>) => void;
  asChild?: boolean;
}

export const MenuTrigger = forwardRef<HTMLDivElement, MenuTriggerProps>(
  function MenuTrigger({ children, asChild }, ref) {
    const { handleOpen } = useMenuContext();

    const handleClick = (event: MouseEvent<HTMLElement>) => {
      handleOpen(event);
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
  /** Position - when "absolute", uses style.left/top for positioning */
  position?: string;
  /** Width */
  width?: string | number;
  /** Z-index */
  zIndex?: string | number;
  /** Class name */
  className?: string;
  /** Line height */
  lineHeight?: string;
  /** Inline styles - used for absolute positioning with left/top */
  style?: React.CSSProperties;
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
      bg,
      borderColor,
      boxShadow,
      minW,
      fontSize,
      position,
      width,
      zIndex,
      className,
      lineHeight,
      style,
      sx,
      ...props
    },
    ref,
  ) {
    const { anchorEl, open, handleClose, positioning } = useMenuContext();
    const anchorOrigin =
      placementToAnchorOrigin[positioning?.placement || "bottom-start"];

    // Support absolute positioning via style.left/top (for context menus)
    const useAbsolutePositioning =
      position === "absolute" &&
      style?.left !== undefined &&
      style?.top !== undefined;

    return (
      <MuiMenu
        ref={ref}
        anchorEl={useAbsolutePositioning ? null : anchorEl}
        anchorReference={useAbsolutePositioning ? "anchorPosition" : "anchorEl"}
        anchorPosition={
          useAbsolutePositioning
            ? {
                top:
                  typeof style.top === "string"
                    ? Number.parseInt(style.top)
                    : (style.top as number),
                left:
                  typeof style.left === "string"
                    ? Number.parseInt(style.left)
                    : (style.left as number),
              }
            : undefined
        }
        open={open}
        onClose={handleClose}
        anchorOrigin={useAbsolutePositioning ? undefined : anchorOrigin}
        className={className}
        sx={{
          ...(zIndex !== undefined && { zIndex }),
          "& .MuiPaper-root": {
            ...(bg && { backgroundColor: bg }),
            ...(borderColor && { borderColor }),
            ...(boxShadow && { boxShadow }),
            ...(minW && { minWidth: minW }),
            ...(fontSize && { fontSize }),
            ...(width && { width }),
            ...(lineHeight && { lineHeight }),
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
  /** Font size */
  fontSize?: string;
  /** Render as child (Chakra compatibility - accepted but ignored) */
  asChild?: boolean;
}

export const MenuItem = forwardRef<HTMLLIElement, MenuItemProps>(
  function MenuItem(
    { children, fontSize, asChild, onClick, sx, ...props },
    ref,
  ) {
    const { handleClose, closeOnSelect } = useMenuContext();

    const handleClick = (event: React.MouseEvent<HTMLLIElement>) => {
      onClick?.(event);
      if (closeOnSelect) {
        handleClose();
      }
    };

    return (
      <MuiMenuItem
        ref={ref}
        onClick={handleClick}
        sx={{
          ...(fontSize && { fontSize }),
          ...sx,
        }}
        {...props}
      >
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
  /** Margin */
  m?: string | number;
  /** Padding */
  p?: string | number;
  /** Padding X */
  px?: string | number;
  /** Group title */
  title?: string;
  /** Render as element type */
  as?: React.ElementType;
  /** Font size */
  fontSize?: string;
}

export function MenuItemGroup({ children, title }: MenuItemGroupProps) {
  return (
    <>
      {title && <MenuItemGroupLabel>{title}</MenuItemGroupLabel>}
      {children}
    </>
  );
}

// Menu Item Group Label
interface MenuItemGroupLabelProps {
  children?: ReactNode;
}

function MenuItemGroupLabel({ children }: MenuItemGroupLabelProps) {
  return (
    <MuiMenuItem
      disabled
      sx={{ opacity: 0.6, fontSize: "0.75rem", fontWeight: 600 }}
    >
      {children}
    </MuiMenuItem>
  );
}

// Menu Radio Item Group - Container for radio items
interface MenuRadioItemGroupProps {
  children?: ReactNode;
  value?: string;
  onValueChange?: (details: { value: string }) => void;
}

const RadioItemGroupContext = createContext<{
  value?: string;
  onValueChange?: (details: { value: string }) => void;
} | null>(null);

function MenuRadioItemGroup({
  children,
  value,
  onValueChange,
}: MenuRadioItemGroupProps) {
  return (
    <RadioItemGroupContext.Provider value={{ value, onValueChange }}>
      {children}
    </RadioItemGroupContext.Provider>
  );
}

// Menu Radio Item
interface MenuRadioItemProps {
  children?: ReactNode;
  value: string;
}

function MenuRadioItem({ children, value }: MenuRadioItemProps) {
  const radioContext = useContext(RadioItemGroupContext);
  const menuContext = useMenuContext();
  const isSelected = radioContext?.value === value;

  const handleClick = () => {
    radioContext?.onValueChange?.({ value });
    if (menuContext.closeOnSelect) {
      menuContext.handleClose();
    }
  };

  return (
    <MuiMenuItem
      onClick={handleClick}
      selected={isSelected}
      sx={{
        "&.Mui-selected": {
          backgroundColor: "action.selected",
        },
      }}
    >
      {children}
    </MuiMenuItem>
  );
}

// Menu Item Indicator - Visual indicator for selected items
function MenuItemIndicator() {
  // Placeholder for selected indicator - MUI uses checkmarks automatically
  return null;
}

// Combined Menu namespace for Chakra-like usage
export const Menu = {
  Root: MenuRoot,
  Trigger: MenuTrigger,
  Positioner: MenuPositioner,
  Content: MenuContent,
  Item: MenuItem,
  ItemGroup: MenuItemGroup,
  ItemGroupLabel: MenuItemGroupLabel,
  Separator: MenuSeparator,
  RadioItemGroup: MenuRadioItemGroup,
  RadioItem: MenuRadioItem,
  ItemIndicator: MenuItemIndicator,
};

export default Menu;
