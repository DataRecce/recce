import { useApiConfigOptional as useDatarecceApiConfigOptional } from "@datarecce/ui";
import { PUBLIC_API_URL } from "@datarecce/ui/lib/const";
import axios, { AxiosInstance } from "axios";

/**
 * OSS API Configuration Adapter
 *
 * This file provides OSS-specific defaults and a fallback chain for API configuration.
 * It is NOT a duplicate of @datarecce/ui's ApiContext - it wraps it with OSS defaults.
 *
 * Priority chain:
 * 1. Local OSS ApiConfigProvider (if present)
 * 2. @datarecce/ui RecceProvider (via useApiConfigOptional)
 * 3. Default config with PUBLIC_API_URL (for backward compatibility)
 *
 * For @datarecce/ui consumers (like recce-cloud-infra), use @datarecce/ui's
 * ApiProvider directly with your own baseUrl and config.
 */

interface ApiConfigContextType {
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
  const datarecceContext = useDatarecceApiConfigOptional();

  // Priority: @datarecce/ui provider > defaults
  return datarecceContext ?? defaultApiConfigContext;
}
