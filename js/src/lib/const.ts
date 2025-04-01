let apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  apiUrl = typeof window !== "undefined" ? window.location.origin : "";
}
export const PUBLIC_API_URL = apiUrl;
