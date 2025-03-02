export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL
  : typeof window !== "undefined"
    ? window.location.origin
    : "";
