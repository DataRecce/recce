import { RecceInstanceInfo } from "@/lib/api/instanceInfo";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";

/**
 * Generate the settings URL based on instance info
 * @param instanceInfo - Recce instance information containing web_url and organization_name
 * @returns Absolute URL to settings page or fallback to calendar booking
 */
export function getSettingsUrl(instanceInfo?: RecceInstanceInfo): string {
  if (instanceInfo?.web_url && instanceInfo?.organization_name) {
    // Use absolute URL from Recce Cloud
    return `${instanceInfo.web_url}/organization/${instanceInfo.organization_name}/settings`;
  }
  // Fallback to calendar booking if not in cloud environment
  return RECCE_SUPPORT_CALENDAR_URL;
}
