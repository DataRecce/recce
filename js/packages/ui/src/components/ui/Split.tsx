"use client";

import type { SplitProps as ReactSplitProps } from "react-split";
import { SplitPane } from "./SplitPane";

/**
 * Props for HSplit and VSplit components
 *
 * These components provide backward-compatible wrappers around SplitPane,
 * accepting the same props as react-split's SplitProps.
 */
export type SplitProps = ReactSplitProps;

/**
 * Horizontal Split Component
 *
 * A convenience wrapper around SplitPane that creates a horizontal (left-right) split.
 * Maintains backward compatibility with react-split's SplitProps interface.
 *
 * @example Basic horizontal split
 * ```tsx
 * import { HSplit } from '@datarecce/ui';
 *
 * function TwoColumnLayout() {
 *   return (
 *     <HSplit sizes={[30, 70]} minSize={100}>
 *       <div>Left Panel</div>
 *       <div>Right Panel</div>
 *     </HSplit>
 *   );
 * }
 * ```
 *
 * @example With custom styling
 * ```tsx
 * <HSplit
 *   sizes={[20, 80]}
 *   minSize={50}
 *   style={{ height: "100%" }}
 * >
 *   <nav>Navigation</nav>
 *   <main>Content</main>
 * </HSplit>
 * ```
 */
export function HSplit(props: SplitProps) {
  const {
    style,
    children,
    gutterSize = 5,
    minSize,
    maxSize,
    sizes,
    snapOffset,
    dragInterval,
    onDragEnd,
    onDrag,
    className,
  } = props;

  return (
    <SplitPane
      direction="horizontal"
      gutterSize={gutterSize}
      minSizes={minSize}
      maxSizes={maxSize}
      sizes={sizes}
      snapOffset={typeof snapOffset === "number" ? snapOffset : undefined}
      dragInterval={dragInterval}
      onDragEnd={onDragEnd}
      onDrag={onDrag}
      style={style}
      className={className}
    >
      {children}
    </SplitPane>
  );
}

/**
 * Vertical Split Component
 *
 * A convenience wrapper around SplitPane that creates a vertical (top-bottom) split.
 * Maintains backward compatibility with react-split's SplitProps interface.
 *
 * @example Basic vertical split
 * ```tsx
 * import { VSplit } from '@datarecce/ui';
 *
 * function TwoRowLayout() {
 *   return (
 *     <VSplit sizes={[60, 40]} minSize={100}>
 *       <div>Top Panel</div>
 *       <div>Bottom Panel</div>
 *     </VSplit>
 *   );
 * }
 * ```
 *
 * @example Nested splits
 * ```tsx
 * <HSplit sizes={[30, 70]}>
 *   <div>Sidebar</div>
 *   <VSplit sizes={[70, 30]}>
 *     <div>Main Content</div>
 *     <div>Footer</div>
 *   </VSplit>
 * </HSplit>
 * ```
 */
export function VSplit(props: SplitProps) {
  const {
    style,
    children,
    gutterSize = 5,
    minSize,
    maxSize,
    sizes,
    snapOffset,
    dragInterval,
    onDragEnd,
    onDrag,
    className,
  } = props;

  return (
    <SplitPane
      direction="vertical"
      gutterSize={gutterSize}
      minSizes={minSize}
      maxSizes={maxSize}
      sizes={sizes}
      snapOffset={typeof snapOffset === "number" ? snapOffset : undefined}
      dragInterval={dragInterval}
      onDragEnd={onDragEnd}
      onDrag={onDrag}
      style={style}
      className={className}
    >
      {children}
    </SplitPane>
  );
}
