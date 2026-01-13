"use client";

import {
  SetupConnectionBanner as BaseSetupConnectionBanner,
  type SetupConnectionBannerProps as BaseSetupConnectionBannerProps,
} from "@datarecce/ui/components/lineage";
import {
  useRecceInstanceContext,
  useRecceInstanceInfo,
} from "@datarecce/ui/contexts";
import { RECCE_SUPPORT_CALENDAR_URL } from "@datarecce/ui/lib/const";
import { getSettingsUrl } from "@datarecce/ui/utils";

/**
 * Props for the OSS SetupConnectionBanner wrapper.
 * Extends the base props but makes injected dependencies optional
 * since they're provided by OSS-specific contexts.
 */
export type SetupConnectionBannerProps =
  Partial<BaseSetupConnectionBannerProps>;

/**
 * OSS wrapper for SetupConnectionBanner.
 *
 * Provides OSS-specific context integration by automatically:
 * - Fetching feature toggles from RecceInstanceContext
 * - Generating settings URL from instance info
 */
export default function SetupConnectionBanner(
  props: SetupConnectionBannerProps,
) {
  const { featureToggles } = useRecceInstanceContext();
  const { data: instanceInfo } = useRecceInstanceInfo();

  return (
    <BaseSetupConnectionBanner
      featureToggles={props.featureToggles ?? featureToggles}
      settingsUrl={
        props.settingsUrl ??
        getSettingsUrl(instanceInfo, RECCE_SUPPORT_CALENDAR_URL)
      }
    />
  );
}
