"use client";

/**
 * @file styles.ts
 * @description Styling utilities for lineage components
 *
 * Provides icons, colors, and styling helpers for:
 * - Change status visualization (added, removed, modified)
 * - Resource type icons (model, source, seed, etc.)
 *
 * Source: Ported from OSS js/src/components/lineage/styles.tsx
 */

import type { ComponentType, SVGProps } from "react";
import { colors } from "../../theme/colors";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Change status for diff visualization
 */
export type ChangeStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Resource types supported by dbt/lineage
 */
export type ResourceType =
  | "model"
  | "source"
  | "seed"
  | "snapshot"
  | "metric"
  | "exposure"
  | "semantic_model";

/**
 * Icon component type
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Result from getIconForChangeStatus
 */
export interface ChangeStatusStyle {
  /** CSS color value for the status */
  color: string;
  /** Hex color value (same as color for compatibility) */
  hexColor: string;
  /** Background color for light/dark mode */
  backgroundColor: string;
  /** Hex background color (same as backgroundColor for compatibility) */
  hexBackgroundColor: string;
  /** Icon component for the status, undefined if no change */
  icon: IconComponent | undefined;
}

/**
 * Result from getIconForResourceType
 */
export interface ResourceTypeStyle {
  /** CSS color value for the resource type */
  color: string;
  /** Icon component for the resource type, undefined if unknown */
  icon: IconComponent | undefined;
}

// =============================================================================
// SVG ICON COMPONENTS
// =============================================================================

/**
 * Plus icon for "added" status
 * Based on VSCode's VscDiffAdded
 */
export const IconAdded: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.5 1h13l.5.5v13l-.5.5h-13l-.5-.5v-13l.5-.5zM2 2v12h12V2H2zm6.5 2.5v2.5h2.5v1H8.5v2.5h-1V8H5V7h2.5V4.5h1z"
    />
  </svg>
);

/**
 * Minus icon for "removed" status
 * Based on VSCode's VscDiffRemoved
 */
export const IconRemoved: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.5 1h13l.5.5v13l-.5.5h-13l-.5-.5v-13l.5-.5zM2 2v12h12V2H2zm3 5.5h6v1H5v-1z"
    />
  </svg>
);

/**
 * Tilde icon for "modified" status
 * Based on VSCode's VscDiffModified
 */
export const IconModified: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M1.5 1h13l.5.5v13l-.5.5h-13l-.5-.5v-13l.5-.5zM2 2v12h12V2H2z" />
    <path d="M10.6 8.7c-.1.1-.3.2-.5.2h-.1l-1.4-.3c-.5-.1-1.1-.3-1.8-.3-.6 0-1 .2-1.3.5-.2.2-.2.4-.2.7v.1l-.9.3v-.2c0-.3 0-.6.1-.9.2-.4.5-.8 1-1.1.5-.4 1.2-.5 2-.5h.2l1.5.4h.1c.5.1 1 .3 1.5.3.6 0 .9-.2 1.2-.4.2-.2.3-.5.3-.8v-.3l.8-.3h.1v.3c0 .6-.2 1.2-.6 1.6-.2.2-.3.4-.5.5l-.5.2z" />
  </svg>
);

/**
 * Dot icon for "changed" status (generic change indicator)
 */
export const IconChanged: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
    />
  </svg>
);

/**
 * Icon for modified with downstream impact indicator
 */
export const IconModifiedDownstream: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.5 1h13l.5.5v13l-.5.5h-13l-.5-.5v-13l.5-.5zM2 2v4h-1v4h1v4h4v1h4v-1h4v-4h1v-4h-1v-4h-4v-1h-4v1h-4z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
    />
  </svg>
);

// =============================================================================
// RESOURCE TYPE ICONS (inline SVGs to avoid react-icons dependency)
// =============================================================================

/**
 * Cube icon for "model" resource type
 */
export const IconModel: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M239.1 6.3l-208 78c-18.7 7-31.1 25-31.1 45v225.1c0 18.2 10.3 34.8 26.5 42.9l208 104c13.5 6.8 29.4 6.8 42.9 0l208-104c16.3-8.1 26.5-24.8 26.5-42.9V129.3c0-20-12.4-37.9-31.1-44.9l-208-78C262 2.2 250 2.2 239.1 6.3zM256 68.4l192 72v1.1l-192 78-192-78v-1.1l192-72zm32 356V275.5l160-65v133.9l-160 80z" />
  </svg>
);

/**
 * Database icon for "source" resource type
 */
export const IconSource: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 448 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M448 73.143v45.714C448 159.143 347.667 192 224 192S0 159.143 0 118.857V73.143C0 32.857 100.333 0 224 0s224 32.857 224 73.143zM448 176v102.857C448 319.143 347.667 352 224 352S0 319.143 0 278.857V176c48.125 33.143 136.208 48.572 224 48.572S399.874 209.143 448 176zm0 160v102.857C448 479.143 347.667 512 224 512S0 479.143 0 438.857V336c48.125 33.143 136.208 48.572 224 48.572S399.874 369.143 448 336z" />
  </svg>
);

/**
 * Seedling icon for "seed" resource type
 */
export const IconSeed: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M64 96H0c0 123.7 100.3 224 224 224v144c0 8.8 7.2 16 16 16h32c8.8 0 16-7.2 16-16V320C288 196.3 187.7 96 64 96zm384-64c-84.2 0-157.4 46.5-195.7 115.2 27.7 30.2 48.2 66.9 59 107.6C424 243.1 512 147.9 512 32h-64z" />
  </svg>
);

/**
 * Camera icon for "snapshot" resource type
 */
export const IconSnapshot: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M512 144v288c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V144c0-26.5 21.5-48 48-48h88l12.3-32.9c7-18.7 24.9-31.1 44.9-31.1h125.5c20 0 37.9 12.4 44.9 31.1L376 96h88c26.5 0 48 21.5 48 48zM376 288c0-66.2-53.8-120-120-120s-120 53.8-120 120 53.8 120 120 120 120-53.8 120-120zm-32 0c0 48.5-39.5 88-88 88s-88-39.5-88-88 39.5-88 88-88 88 39.5 88 88z" />
  </svg>
);

/**
 * Chart icon for "metric" resource type
 */
export const IconMetric: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 448 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M160 80c0-26.5 21.5-48 48-48h32c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48h-32c-26.5 0-48-21.5-48-48V80zM0 272c0-26.5 21.5-48 48-48h32c26.5 0 48 21.5 48 48v160c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V272zM368 96h32c26.5 0 48 21.5 48 48v288c0 26.5-21.5 48-48 48h-32c-26.5 0-48-21.5-48-48V144c0-26.5 21.5-48 48-48z" />
  </svg>
);

/**
 * Gauge icon for "exposure" resource type
 */
export const IconExposure: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256zm320 96c0-15.9-5.8-30.4-15.3-41.6l76.6-147.4c6.1-11.8 1.5-26.3-10.2-32.4s-26.2-1.5-32.4 10.2L262.1 288.3c-2-.2-4-.3-6.1-.3c-35.3 0-64 28.7-64 64s28.7 64 64 64s64-28.7 64-64z" />
  </svg>
);

/**
 * Nodes icon for "semantic_model" resource type
 */
export const IconSemanticModel: IconComponent = (props) => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 512 512"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M418.4 157.9c35.3-8.3 61.6-40 61.6-77.9c0-44.2-35.8-80-80-80c-43.4 0-78.7 34.5-80 77.5L136.2 151.1C121.7 136.8 101.9 128 80 128c-44.2 0-80 35.8-80 80s35.8 80 80 80c12.2 0 23.8-2.7 34.1-7.6L259.7 407.8c-2.4 7.6-3.7 15.8-3.7 24.2c0 44.2 35.8 80 80 80s80-35.8 80-80c0-27.7-14-52.1-35.4-66.4l37.8-207.7zM156.3 232.2c2.2-6.9 3.5-14.2 3.7-21.7l183.8-73.5c3.6 3.5 7.4 6.7 11.6 9.5L317.6 354.1c-5.5 1.3-10.8 3.1-15.8 5.5L156.3 232.2z" />
  </svg>
);

// =============================================================================
// STYLING FUNCTIONS
// =============================================================================

/**
 * Get icon and colors for a change status
 *
 * @param changeStatus - The change status (added, removed, modified)
 * @param isDark - Whether dark mode is active
 * @returns Object containing color values and icon component
 *
 * @example
 * ```tsx
 * const { color, icon: Icon } = getIconForChangeStatus("added");
 * return <Icon style={{ color }} />;
 * ```
 */
export function getIconForChangeStatus(
  changeStatus?: ChangeStatus,
  isDark?: boolean,
): ChangeStatusStyle {
  if (changeStatus === "added") {
    return {
      color: colors.green[500],
      hexColor: colors.green[500],
      backgroundColor: isDark ? colors.green[900] : colors.green[100],
      hexBackgroundColor: isDark ? colors.green[900] : colors.green[100],
      icon: IconAdded,
    };
  }

  if (changeStatus === "removed") {
    return {
      color: colors.red[500],
      hexColor: colors.red[500],
      backgroundColor: isDark ? colors.red[950] : colors.red[200],
      hexBackgroundColor: isDark ? colors.red[950] : colors.red[200],
      icon: IconRemoved,
    };
  }

  if (changeStatus === "modified") {
    return {
      color: colors.amber[500],
      hexColor: colors.amber[500],
      backgroundColor: isDark ? colors.amber[900] : colors.amber[100],
      hexBackgroundColor: isDark ? colors.amber[900] : colors.amber[100],
      icon: IconModified,
    };
  }

  // Default: no change
  return {
    color: colors.neutral[500],
    hexColor: colors.neutral[500],
    backgroundColor: isDark ? colors.neutral[700] : colors.white,
    hexBackgroundColor: isDark ? colors.neutral[700] : colors.white,
    icon: undefined,
  };
}

/**
 * Get icon and color for a resource type
 *
 * @param resourceType - The resource type (model, source, seed, etc.)
 * @returns Object containing color and icon component
 *
 * @example
 * ```tsx
 * const { color, icon: Icon } = getIconForResourceType("model");
 * return Icon ? <Icon style={{ color }} /> : null;
 * ```
 */
export function getIconForResourceType(
  resourceType?: string,
): ResourceTypeStyle {
  switch (resourceType) {
    case "model":
      return {
        color: colors.cyan[200],
        icon: IconModel,
      };
    case "source":
      return {
        color: colors.green[300],
        icon: IconSource,
      };
    case "seed":
      return {
        color: colors.green[500],
        icon: IconSeed,
      };
    case "snapshot":
      return {
        color: colors.green[500],
        icon: IconSnapshot,
      };
    case "metric":
      return {
        color: colors.rose[200],
        icon: IconMetric,
      };
    case "exposure":
      return {
        color: colors.rose[200],
        icon: IconExposure,
      };
    case "semantic_model":
      return {
        color: colors.rose[400],
        icon: IconSemanticModel,
      };
    default:
      return {
        color: "inherit",
        icon: undefined,
      };
  }
}

// =============================================================================
// STYLE CONSTANTS
// =============================================================================

/**
 * Pre-defined colors for change status (for direct usage without function call)
 */
export const changeStatusColors: Record<ChangeStatus | "unchanged", string> = {
  added: colors.green[500],
  removed: colors.red[500],
  modified: colors.amber[500],
  unchanged: colors.neutral[500],
};

/**
 * Pre-defined background colors for change status (light mode)
 */
export const changeStatusBackgroundsLight: Record<
  ChangeStatus | "unchanged",
  string
> = {
  added: colors.green[100],
  removed: colors.red[200],
  modified: colors.amber[100],
  unchanged: colors.white,
};

/**
 * Pre-defined background colors for change status (dark mode)
 */
export const changeStatusBackgroundsDark: Record<
  ChangeStatus | "unchanged",
  string
> = {
  added: colors.green[900],
  removed: colors.red[950],
  modified: colors.amber[900],
  unchanged: colors.neutral[700],
};
