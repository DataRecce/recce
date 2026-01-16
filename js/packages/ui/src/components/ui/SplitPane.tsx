"use client";

import "./splitStyles.css";
import Box from "@mui/material/Box";
import { type CSSProperties, memo, type ReactNode } from "react";
import Split from "react-split";
import { useIsDark } from "../../hooks/useIsDark";

/**
 * Split direction
 */
export type SplitDirection = "horizontal" | "vertical";

/**
 * Props for the SplitPane component
 */
export interface SplitPaneProps {
  /** Child elements to split */
  children: ReactNode;
  /** Split direction */
  direction?: SplitDirection;
  /** Initial sizes as percentages (should sum to 100) */
  sizes?: number[];
  /** Minimum sizes in pixels */
  minSizes?: number | number[];
  /** Maximum sizes in pixels */
  maxSizes?: number | number[];
  /** Gutter (drag handle) size in pixels */
  gutterSize?: number;
  /** Snap to closed at this threshold (pixels) */
  snapOffset?: number;
  /** Allow dragging past minSize to collapse */
  dragInterval?: number;
  /** Callback when sizes change */
  onDragEnd?: (sizes: number[]) => void;
  /** Callback during drag */
  onDrag?: (sizes: number[]) => void;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Container style */
  style?: CSSProperties;
  /** Optional CSS class */
  className?: string;
}

/**
 * SplitPane Component
 *
 * A pure presentation component for creating resizable split panes
 * using react-split. Supports horizontal and vertical layouts.
 *
 * @example Horizontal split
 * ```tsx
 * import { SplitPane } from '@datarecce/ui/primitives';
 *
 * function TwoColumnLayout() {
 *   return (
 *     <SplitPane direction="horizontal" sizes={[30, 70]}>
 *       <div>Left Panel</div>
 *       <div>Right Panel</div>
 *     </SplitPane>
 *   );
 * }
 * ```
 *
 * @example Vertical split with min sizes
 * ```tsx
 * <SplitPane
 *   direction="vertical"
 *   sizes={[50, 50]}
 *   minSizes={[100, 100]}
 * >
 *   <div>Top Panel</div>
 *   <div>Bottom Panel</div>
 * </SplitPane>
 * ```
 *
 * @example Three-way split with callbacks
 * ```tsx
 * <SplitPane
 *   direction="horizontal"
 *   sizes={[25, 50, 25]}
 *   onDragEnd={(sizes) => saveSizes(sizes)}
 * >
 *   <div>Navigation</div>
 *   <div>Content</div>
 *   <div>Details</div>
 * </SplitPane>
 * ```
 */
function SplitPaneComponent({
  children,
  direction = "horizontal",
  sizes,
  minSizes = 0,
  maxSizes,
  gutterSize = 5,
  snapOffset = 30,
  dragInterval = 1,
  onDragEnd,
  onDrag,
  theme,
  style,
  className,
}: SplitPaneProps) {
  const isDarkAuto = useIsDark();
  const isDark = theme ? theme === "dark" : isDarkAuto;

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: direction === "horizontal" ? "row" : "column",
    height: "100%",
    width: "100%",
    ...style,
  };

  return (
    <Box
      className={className}
      sx={{
        height: "100%",
        width: "100%",
        "& .gutter": {
          backgroundColor: "divider",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "50%",
          transition: "background-color 0.15s ease",
          "&:hover": {
            backgroundColor: isDark ? "grey.600" : "grey.300",
          },
        },
        "& .gutter.gutter-horizontal": {
          cursor: "col-resize",
        },
        "& .gutter.gutter-vertical": {
          cursor: "row-resize",
        },
      }}
    >
      <Split
        style={containerStyle}
        direction={direction}
        sizes={sizes}
        minSize={minSizes}
        maxSize={maxSizes}
        gutterSize={gutterSize}
        snapOffset={snapOffset}
        dragInterval={dragInterval}
        onDragEnd={onDragEnd}
        onDrag={onDrag}
      >
        {children}
      </Split>
    </Box>
  );
}

export const SplitPane = memo(SplitPaneComponent);
SplitPane.displayName = "SplitPane";
