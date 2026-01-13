"use client";

import { useRecceInstanceContext, useRecceInstanceInfo } from "../../contexts";
import { RECCE_SUPPORT_CALENDAR_URL } from "../../lib/const";
import { getSettingsUrl } from "../../utils";
import {
  SetupConnectionBanner as BaseSetupConnectionBanner,
  type SetupConnectionBannerProps as BaseSetupConnectionBannerProps,
} from "./SetupConnectionBanner";

/**
 * Props for the OSS SetupConnectionBanner wrapper.
 * Extends the base props but makes injected dependencies optional
 * since they're provided by OSS-specific contexts.
 */
export type SetupConnectionBannerOssProps =
  Partial<BaseSetupConnectionBannerProps>;

/**
 * OSS wrapper for SetupConnectionBanner.
 *
 * Provides OSS-specific context integration by automatically:
 * - Fetching feature toggles from RecceInstanceContext
 * - Generating settings URL from instance info
 */
export default function SetupConnectionBannerOss(
  props: SetupConnectionBannerOssProps,
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
