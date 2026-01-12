"use client";

/**
 * SingleEnvironmentQueryView - OSS wrapper for @datarecce/ui components
 *
 * This file re-exports the BaseEnvironmentSetupGuide and BaseEnvironmentSetupNotification
 * components from @datarecce/ui, pre-configured with OSS-specific defaults.
 *
 * These components display guidance when Recce is running in single environment mode
 * (limited functionality mode), explaining how to set up a base environment.
 */

// Re-export components from @datarecce/ui with OSS-specific documentation URLs
export {
  BaseEnvironmentSetupGuide,
  type BaseEnvironmentSetupGuideProps,
  BaseEnvironmentSetupNotification,
  type BaseEnvironmentSetupNotificationProps,
} from "@datarecce/ui/components/lineage";
