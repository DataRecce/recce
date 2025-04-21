let apiUrl = process.env.NEXT_PUBLIC_API_URL;
apiUrl ??= typeof window !== "undefined" ? window.location.origin : "";

export const PUBLIC_API_URL = apiUrl;

let cloudWebUrl = process.env.NEXT_PUBLIC_CLOUD_WEB_URL;
cloudWebUrl ??= "https://cloud.datarecce.io";

export const PUBLIC_CLOUD_WEB_URL = cloudWebUrl;
