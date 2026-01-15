import axios, { type AxiosInstance } from "axios";
import { PUBLIC_API_URL } from "../lib/const";
import { useApiConfigOptional } from "../providers";

/**
 * API configuration adapter for OSS and cloud hosts.
 *
 * @remarks
 * Fallback chain:
 * 1. RecceProvider (via useApiConfigOptional)
 * 2. Default config using PUBLIC_API_URL
 */
export interface ApiConfigContextType {
  /**
   * API endpoint prefix to replace `/api` in all requests.
   * For OSS: "" (empty string, uses default /api/* paths)
   * For Cloud: "/api/v2/sessions/<session_id>" (replaces /api with this)
   */
  apiPrefix: string;

  /**
   * Optional authentication token for API requests.
   * When provided, adds "Authorization: Bearer <token>" header.
   */
  authToken?: string;

  /**
   * Optional base URL override.
   * When provided, overrides the PUBLIC_API_URL for this context.
   */
  baseUrl?: string;
  /**
   * Pre-configured axios instance with interceptors for
   * API prefix replacement and auth token injection.
   */
  apiClient: AxiosInstance;
}

// Default config used when ApiConfigProvider is not present (OSS mode)
const defaultApiConfigContext: ApiConfigContextType = {
  apiPrefix: "",
  authToken: undefined,
  baseUrl: undefined,
  apiClient: axios.create({ baseURL: PUBLIC_API_URL }),
};

/**
 * Access the API configuration and configured axios client.
 *
 * @remarks
 * Priority order:
 * 1. RecceProvider (via useApiConfigOptional)
 * 2. Default config (for backward compatibility)
 */
export function useApiConfig(): ApiConfigContextType {
  // Call both hooks unconditionally (React hooks rules)
  const datarecceContext = useApiConfigOptional();

  // Priority: @datarecce/ui provider > defaults
  return datarecceContext ?? defaultApiConfigContext;
}
