"use client";

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
 */

interface TabsContextValue {
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
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
export interface TabsRootProps {
  /** Default selected tab index */
  defaultIndex?: number;
  /** Controlled selected tab index */
  index?: number;
  /** Callback when tab changes */
  onChange?: (index: number) => void;
  /** Children */
  children?: ReactNode;
  /** Chakra variant */
  variant?: "line" | "enclosed" | "soft-rounded" | "solid-rounded";
  /** Whether tabs should take full width */
  fitted?: boolean;
  /** Chakra colorPalette */
  colorPalette?: string;
}

function TabsRoot({
  defaultIndex = 0,
  index,
  onChange,
  children,
}: TabsRootProps) {
  const [internalValue, setInternalValue] = useState(defaultIndex);
  const value = index !== undefined ? index : internalValue;

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    if (index === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value, onChange: handleChange }}>
      <Box>{children}</Box>
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
export interface TabTriggerProps extends Omit<MuiTabProps, "ref" | "children"> {
  children?: ReactNode;
}

const TabTrigger = forwardRef<HTMLDivElement, TabTriggerProps>(
  function TabTrigger({ children, label, ...props }, ref) {
    return <MuiTab ref={ref} label={label || children} {...props} />;
  },
);

// Tab content wrapper
export interface TabContentProps {
  /** Index of this tab panel */
  index?: number;
  /** Value to match against */
  value?: number;
  children?: ReactNode;
}

function TabContent({ index, value, children }: TabContentProps) {
  const context = useTabsContext();
  const currentIndex = value ?? context.value;
  const panelIndex = index ?? 0;

  if (currentIndex !== panelIndex) {
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
