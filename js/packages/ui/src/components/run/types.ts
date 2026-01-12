"use client";

/**
 * @file run/types.ts
 * @description Shared types for run components that are extensible by consumers.
 * These types support dependency injection patterns for OSS-specific behavior.
 */

import type {
  ComponentType,
  ForwardRefExoticComponent,
  Ref,
  RefAttributes,
} from "react";
import type {
  AxiosQueryParams,
  HistogramDiffParams,
  LineageDiffViewOptions,
  ProfileDiffParams,
  ProfileDiffViewOptions,
  QueryDiffViewOptions,
  QueryViewOptions,
  Run,
  RunType,
  TopKDiffParams,
  TopKViewOptions,
  ValueDiffDetailViewOptions,
  ValueDiffParams,
} from "../../api";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import type { DiffViewOptions } from "./RunToolbar";

// ============================================================================
// Run Form Types
// ============================================================================

/**
 * Base props for run form components.
 * Generic type PT represents the params type for the specific run type.
 *
 * @example
 * interface MyFormProps extends RunFormProps<MyRunParams> {}
 */
export interface RunFormProps<PT = unknown> {
  /** Current form parameter values */
  params: Partial<PT>;
  /** Callback when params change */
  onParamsChanged: (params: Partial<PT>) => void;
  /** Callback to set whether the form is valid and ready to execute */
  setIsReadyToExecute: (isReadyToExecute: boolean) => void;
}

// ============================================================================
// Run Result View Types
// ============================================================================

/**
 * Base props for run result view components.
 * Generic type VO represents the view options type for the specific run type.
 *
 * @example
 * interface MyResultViewProps extends RunResultViewProps<MyViewOptions> {}
 */
export interface RunResultViewProps<VO = unknown> {
  /** The run object containing execution results */
  run: Run;
  /** Optional view options to control how results are displayed */
  viewOptions?: VO;
  /** Callback when view options change */
  onViewOptionsChanged?: (viewOptions: VO) => void;
}

// ============================================================================
// Icon Type (Dependency Injection)
// ============================================================================

/**
 * Type for icon components - compatible with react-icons IconType pattern.
 * Uses a permissive type to allow react-icons IconType and custom icon components.
 *
 * This type accepts any component that can render an icon. The actual props
 * depend on the icon library used (react-icons, @mui/icons-material, etc.)
 */
// biome-ignore lint/suspicious/noExplicitAny: Intentionally permissive to work with react-icons IconType
export type IconComponent = ComponentType<any>;

// ============================================================================
// Registry Entry Types
// ============================================================================

/**
 * Configuration for a single run type in the registry.
 * Icons and components are injectable, enabling extension/override.
 *
 * @param RefType - Type for the ref (DataGridHandle, HTMLDivElement, etc.)
 * @param ViewOptions - Type for view options specific to this run type
 * @param FormParams - Type for form parameters specific to this run type
 */
export interface RunTypeConfig<
  RefType = unknown,
  ViewOptions = unknown,
  FormParams = unknown,
> {
  /** Human-readable title for the run type */
  title: string;

  /** Icon component for the run type - injectable for customization */
  icon: IconComponent;

  /** Optional result view component (forwardRef) for rendering run results */
  RunResultView?: ForwardRefExoticComponent<
    RunResultViewProps<ViewOptions> & RefAttributes<RefType>
  >;

  /** Optional form component for configuring run parameters */
  RunForm?: ComponentType<RunFormProps<FormParams>>;
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Interface for the full run type registry.
 * Consumers can extend this with additional run types:
 *
 * @example
 * const cloudRegistry: RunTypeRegistry & { custom: RunTypeConfig } = {
 *   ...defaultRunTypeRegistry,
 *   custom: { title: "Custom", icon: MyIcon }
 * };
 */
export type RunTypeRegistry = {
  [K in RunType]: RunTypeConfig;
};

/**
 * Partial registry for registry extension/override patterns.
 * Useful when consumers want to override only some run types.
 *
 * @example
 * const overrides: Partial<RunTypeRegistry> = {
 *   query: { ...defaultRunTypeRegistry.query, icon: CustomQueryIcon }
 * };
 */
export type PartialRunTypeRegistry = Partial<RunTypeRegistry>;

// ============================================================================
// Ref Types (for components that support forwardRef)
// ============================================================================

/**
 * Union of ref types used by run result views.
 * DataGridHandle for data grid components, HTMLDivElement for others.
 */
export type RunResultViewRef = Ref<unknown> | Ref<HTMLDivElement>;

// ============================================================================
// OSS-Compatible Type Aliases
// ============================================================================

/**
 * Union of all view option types used across run result views.
 * Includes options for lineage diff, query diff, profile diff, etc.
 */
export type ViewOptionTypes =
  | LineageDiffViewOptions
  | DiffViewOptions
  | QueryViewOptions
  | QueryDiffViewOptions
  | ProfileDiffViewOptions
  | ValueDiffDetailViewOptions
  | TopKViewOptions;

/**
 * Union of ref types for result views.
 * DataGridHandle for data grid components, HTMLDivElement for others.
 */
export type RefTypes = Ref<DataGridHandle> | Ref<HTMLDivElement>;

/**
 * Union of form param types for run forms.
 * These are the API-level parameter types.
 */
export type RunFormParamTypes =
  | ProfileDiffParams
  | ValueDiffParams
  | TopKDiffParams
  | HistogramDiffParams
  | AxiosQueryParams;

/**
 * Alias for RunTypeConfig for backward compatibility with OSS code.
 * RegistryEntry was the original name used in OSS registry.ts.
 *
 * @param RefType - Type for the ref (DataGridHandle, HTMLDivElement, etc.)
 * @param ViewOptions - Type for view options specific to this run type
 * @param FormParams - Type for form parameters specific to this run type
 */
export type RegistryEntry<
  RefType = RefTypes,
  ViewOptions = ViewOptionTypes,
  FormParams = RunFormParamTypes,
> = RunTypeConfig<RefType, ViewOptions, FormParams>;
