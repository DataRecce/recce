let apiUrl = process.env.NEXT_PUBLIC_API_URL;
apiUrl ??= typeof window !== "undefined" ? window.location.origin : "";

export const PUBLIC_API_URL = apiUrl;

let cloudWebUrl = process.env.NEXT_PUBLIC_CLOUD_WEB_URL;
cloudWebUrl ??= "https://cloud.datarecce.io";

export const PUBLIC_CLOUD_WEB_URL = cloudWebUrl;

let recceSupportCalendarUrl =
  process.env.NEXT_PUBLIC_RECCE_SUPPORT_CALENDAR_URL;
recceSupportCalendarUrl ??= "https://cal.com/team/recce/chat";

export const RECCE_SUPPORT_CALENDAR_URL = recceSupportCalendarUrl;
