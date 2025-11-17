import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { RecceInstanceInfo } from "@/lib/api/instanceInfo";

/**
 * Generate the settings URL based on instance info
 * @param instanceInfo - Recce instance information containing web_url and organization_name
 * @returns Absolute URL to settings page or fallback to calendar booking
 */
export function getSettingsUrl(instanceInfo?: RecceInstanceInfo): string {
  if (instanceInfo?.organization_name && instanceInfo.web_url) {
    // Use absolute URL from Recce Cloud
    return `${instanceInfo.web_url}/organizations/${instanceInfo.organization_name}/settings`;
  }
  // Fallback to calendar booking if not in cloud environment
  return RECCE_SUPPORT_CALENDAR_URL;
}
