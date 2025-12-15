/**
 * MUI Component Library for Recce
 *
 * This directory provides MUI-based components with Chakra-like APIs.
 *
 * Usage:
 * ```tsx
 * import { Box, Flex, Text } from "@/components/ui/mui";
 * ```
 */

// Re-export hooks from mui-utils
export { type UseDisclosureReturn, useDisclosure } from "../mui-utils";
// Layout Components
export { Box, type BoxProps } from "./Box";
// Overlay Components
export { Flex, type FlexProps } from "./Flex";
export {
  Popover,
  PopoverBody,
  type PopoverBodyProps,
  PopoverContent,
  type PopoverContentProps,
  PopoverRoot,
  type PopoverRootProps,
  PopoverTrigger,
  type PopoverTriggerProps,
} from "./Popover";
export { Portal, type PortalProps } from "./Portal";
export { Spacer } from "./Spacer";
export { Spinner, type SpinnerProps } from "./Spinner";
export {
  HStack,
  Stack,
  type StackProps,
  StackSeparator,
  type StackSeparatorProps,
  VStack,
} from "./Stack";
export {
  TabContent,
  type TabContentProps,
  TabList,
  type TabListProps,
  TabPanels,
  type TabPanelsProps,
  Tabs,
  type TabsRootProps,
  TabTrigger,
  type TabTriggerProps,
} from "./Tabs";
export { Text, type TextProps } from "./Text";
export { Tooltip, type TooltipProps } from "./Tooltip";
