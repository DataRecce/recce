"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import type { TabProps as MuiTabProps } from "@mui/material/Tab";
import MuiTab from "@mui/material/Tab";
import type { TabsProps as MuiTabsProps } from "@mui/material/Tabs";
import MuiTabs from "@mui/material/Tabs";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useState,
} from "react";

/**
 * Tabs Component - MUI equivalent of Chakra's Tabs
 *
 * A tabbed interface component using compound pattern.
 * Supports both numeric indices and string values for tab selection.
 */

type TabValue = string | number;

interface TabsContextValue {
  value: TabValue;
  onChange: (event: React.SyntheticEvent, newValue: TabValue) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within Tabs.Root");
  }
  return context;
}

// Root component
export interface TabsRootProps extends Omit<BoxProps, "onChange"> {
  /** Default selected tab index (for numeric mode) */
  defaultIndex?: number;
  /** Default selected tab value (for string mode) */
  defaultValue?: TabValue;
  /** Controlled selected tab index (numeric mode) */
  index?: number;
  /** Controlled selected tab value (string mode) - Chakra compatibility */
  value?: TabValue;
  /** Callback when tab changes - receives index or value depending on mode */
  onChange?: (value: TabValue) => void;
  /** Children */
  children?: ReactNode;
  /** Chakra variant */
  variant?: "line" | "enclosed" | "soft-rounded" | "solid-rounded";
  /** Chakra size */
  size?: "sm" | "md" | "lg";
  /** Whether tabs should take full width */
  fitted?: boolean;
  /** Chakra colorPalette */
  colorPalette?: string;
}

function TabsRoot({
  defaultIndex,
  defaultValue,
  index,
  value,
  onChange,
  children,
  variant,
  size,
  fitted,
  colorPalette,
  sx,
  ...boxProps
}: TabsRootProps) {
  // Determine initial value - prefer string value over numeric index
  const initialValue = value ?? defaultValue ?? index ?? defaultIndex ?? 0;
  const [internalValue, setInternalValue] = useState<TabValue>(initialValue);

  // Controlled value takes precedence
  const currentValue = value ?? index ?? internalValue;

  const handleChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    if (value === undefined && index === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <TabsContext.Provider
      value={{ value: currentValue, onChange: handleChange }}
    >
      <Box sx={sx} {...boxProps}>
        {children}
      </Box>
    </TabsContext.Provider>
  );
}

// Tab list component
export interface TabListProps
  extends Omit<MuiTabsProps, "ref" | "value" | "onChange"> {
  children?: ReactNode;
}

const TabList = forwardRef<HTMLDivElement, TabListProps>(function TabList(
  { children, ...props },
  ref,
) {
  const { value, onChange } = useTabsContext();

  return (
    <MuiTabs ref={ref} value={value} onChange={onChange} {...props}>
      {children}
    </MuiTabs>
  );
});

// Individual tab component
export interface TabTriggerProps
  extends Omit<MuiTabProps, "ref" | "children" | "value"> {
  children?: ReactNode;
  /** Value for this tab (string or number) */
  value?: TabValue;
}

const TabTrigger = forwardRef<HTMLDivElement, TabTriggerProps>(
  function TabTrigger({ children, label, value, ...props }, ref) {
    return (
      <MuiTab ref={ref} label={label || children} value={value} {...props} />
    );
  },
);

// Tab content wrapper
export interface TabContentProps {
  /** Index of this tab panel (for numeric mode) */
  index?: number;
  /** Value to match against */
  value?: TabValue;
  children?: ReactNode;
}

function TabContent({ index, value, children }: TabContentProps) {
  const context = useTabsContext();
  const currentValue = context.value;
  const panelValue = value ?? index ?? 0;

  if (currentValue !== panelValue) {
    return null;
  }

  return <Box sx={{ py: 2 }}>{children}</Box>;
}

// Tab panels container
export interface TabPanelsProps {
  children?: ReactNode;
}

function TabPanels({ children }: TabPanelsProps) {
  const { value } = useTabsContext();

  // Clone children and pass index
  const panels = Array.isArray(children) ? children : [children];

  return (
    <>
      {panels.map((child, index) => {
        if (!child) return null;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: tab panels have stable order by design
          <TabContent key={index} index={index} value={value}>
            {child}
          </TabContent>
        );
      })}
    </>
  );
}

// Compound component export
export const Tabs = {
  Root: TabsRoot,
  List: TabList,
  Trigger: TabTrigger,
  Content: TabContent,
  Panels: TabPanels,
};

// Direct exports for backward compatibility
export { TabsRoot, TabList, TabTrigger, TabContent, TabPanels };

export default Tabs;
