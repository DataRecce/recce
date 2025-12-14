/**
 * MUI Component Library for Recce
 *
 * This directory provides MUI-based components with APIs similar to Chakra UI
 * to facilitate gradual migration. Import from this module instead of @chakra-ui/react
 * for new code or when migrating existing components.
 *
 * Usage:
 * ```tsx
 * // Instead of:
 * import { Box, Flex, Text } from "@chakra-ui/react";
 *
 * // Use:
 * import { Box, Flex, Text } from "@/components/ui/mui";
 * ```
 */

// Re-export hooks from mui-utils
export { type UseDisclosureReturn, useDisclosure } from "../mui-utils";
// Feedback Components
export { Badge, type BadgeProps, Tag } from "./Badge";
// Layout Components
export { Box, type BoxProps } from "./Box";
// Button Components
export { Button, type ButtonProps } from "./Button";
export { Center, type CenterProps } from "./Center";
export { CloseButton, type CloseButtonProps } from "./CloseButton";
export { Divider, type DividerProps, Separator } from "./Divider";
export { Flex, type FlexProps } from "./Flex";
export { Grid, GridItem, type GridItemProps, type GridProps } from "./Grid";
// Typography Components
export { Heading, type HeadingProps } from "./Heading";
export { IconButton, type IconButtonProps } from "./IconButton";
// Navigation Components
export { Link, type LinkProps } from "./Link";
export { Spacer } from "./Spacer";
export { Spinner, type SpinnerProps } from "./Spinner";
export { HStack, Stack, type StackProps, VStack } from "./Stack";
export { Text, type TextProps } from "./Text";
