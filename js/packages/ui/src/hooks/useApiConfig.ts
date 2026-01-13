import axios, { type AxiosInstance } from "axios";
import { PUBLIC_API_URL } from "../lib/const";
import { useApiConfigOptional } from "../providers";

/**
 * API Configuration Adapter
 *
 * Provides a fallback chain for API configuration.
 *
 * Priority chain:
 * 1. @datarecce/ui RecceProvider (via useApiConfigOptional)
 * 2. Default config with PUBLIC_API_URL (for backward compatibility)
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
 * Hook to access the API configuration and configured axios client.
 *
 * Priority order:
 * 1. @datarecce/ui RecceProvider (via useApiConfigOptional)
 * 2. Default config (for backward compatibility)
 *
 * @returns ApiConfigContextType with apiPrefix, authToken, and apiClient
 */
export function useApiConfig(): ApiConfigContextType {
  // Call both hooks unconditionally (React hooks rules)
  const datarecceContext = useApiConfigOptional();

  // Priority: @datarecce/ui provider > defaults
  return datarecceContext ?? defaultApiConfigContext;
}
