import type { RecceInstanceInfo } from "../api";

/**
 * Generate the settings URL based on instance info.
 *
 * @param instanceInfo - Recce instance information containing web_url and organization_name
 * @param fallbackUrl - URL to use when not in cloud environment (e.g., calendar booking)
 * @returns Absolute URL to settings page or the fallback URL
 *
 * @example
 * ```typescript
 * // With cloud instance info
 * getSettingsUrl(instanceInfo, "https://cal.com/team/recce/chat");
 * // Returns: "https://cloud.recce.io/organizations/my-org/settings"
 *
 * // Without cloud instance info
 * getSettingsUrl(undefined, "https://cal.com/team/recce/chat");
 * // Returns: "https://cal.com/team/recce/chat"
 * ```
 */
export function getSettingsUrl(
  instanceInfo: RecceInstanceInfo | undefined,
  fallbackUrl: string,
): string {
  if (instanceInfo?.organization_name && instanceInfo.web_url) {
    // Use absolute URL from Recce Cloud
    return `${instanceInfo.web_url}/organizations/${instanceInfo.organization_name}/settings`;
  }
  // Fallback URL when not in cloud environment
  return fallbackUrl;
}
