"use client";

/**
 * Feature mode for the Recce instance.
 * - "read only": No modifications allowed
 * - "metadata only": Database queries disabled
 * - null: Full functionality enabled
 */
export type RecceFeatureMode = "read only" | "metadata only" | null;

/**
 * Feature toggles that control what actions are available in the UI.
 * These are derived from the server's instance info based on server mode.
 */
export interface RecceFeatureToggles {
  /** Current feature mode based on server_mode */
  mode: RecceFeatureMode;
  /** Disable saving state to file */
  disableSaveToFile: boolean;
  /** Disable exporting state file */
  disableExportStateFile: boolean;
  /** Disable importing state file */
  disableImportStateFile: boolean;
  /** Disable updating checklist */
  disableUpdateChecklist: boolean;
  /** Disable database query execution */
  disableDatabaseQuery: boolean;
  /** Disable view action dropdown menu */
  disableViewActionDropdown: boolean;
  /** Disable node action dropdown menu */
  disableNodeActionDropdown: boolean;
  /** Disable share functionality */
  disableShare: boolean;
}

/**
 * Instance information exposed through the RecceInstanceContext.
 * Contains feature toggles and session information.
 */
export interface InstanceInfoType {
  /** Whether running in single environment mode */
  singleEnv: boolean;
  /** Whether user is authenticated */
  authed: boolean;
  /** Feature toggles based on server mode */
  featureToggles: RecceFeatureToggles;
  /** When the instance lifetime expires */
  lifetimeExpiredAt?: Date;
  /** URL for sharing the instance */
  shareUrl?: string;
  /** Current session ID */
  sessionId?: string;
}

/**
 * Default feature toggles with all features enabled.
 */
export const defaultFeatureToggles: RecceFeatureToggles = {
  mode: null,
  disableSaveToFile: false,
  disableExportStateFile: false,
  disableImportStateFile: false,
  disableUpdateChecklist: false,
  disableDatabaseQuery: false,
  disableViewActionDropdown: false,
  disableNodeActionDropdown: false,
  disableShare: false,
};

/**
 * Default instance info values.
 */
export const defaultInstanceInfo: InstanceInfoType = {
  singleEnv: false,
  authed: false,
  lifetimeExpiredAt: undefined,
  featureToggles: defaultFeatureToggles,
  shareUrl: undefined,
  sessionId: undefined,
};
