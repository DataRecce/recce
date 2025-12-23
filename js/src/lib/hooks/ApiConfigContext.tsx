import axios, { AxiosInstance } from "axios";
import React, { createContext, useContext, useMemo } from "react";
import { PUBLIC_API_URL } from "@/lib/const";

/**
 * API Configuration Context
 *
 * Provides configurable API endpoint prefix and authentication token
 * for use with recce-cloud or other custom API backends.
 *
 * Default behavior (OSS):
 * - apiPrefix: "" (uses /api/* paths directly)
 * - authToken: undefined (no auth header)
 *
 * Cloud usage example:
 * - apiPrefix: "/api/v2/sessions/abc123" (replaces /api with this prefix)
 * - authToken: "eyJ..." (adds Authorization: Bearer header)
 */

export interface ApiConfig {
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
}

interface ApiConfigContextType extends ApiConfig {
  /**
   * Pre-configured axios instance with interceptors for
   * API prefix replacement and auth token injection.
   */
  apiClient: AxiosInstance;
}

const defaultConfig: ApiConfig = {
  apiPrefix: "",
  authToken: undefined,
  baseUrl: undefined,
};

const ApiConfigContext = createContext<ApiConfigContextType | null>(null);

interface ApiConfigProviderProps extends Partial<ApiConfig> {
  children: React.ReactNode;
}

/**
 * Creates an axios instance configured with the given API config.
 *
 * The instance has interceptors that:
 * 1. Replace /api prefix with the configured apiPrefix (if provided)
 * 2. Add Authorization header with Bearer token (if authToken provided)
 */
function createApiClient(config: ApiConfig): AxiosInstance {
  const { apiPrefix, authToken, baseUrl } = config;

  const client = axios.create({
    baseURL: baseUrl ?? PUBLIC_API_URL,
  });

  // Request interceptor to modify URL and add auth header
  client.interceptors.request.use((requestConfig) => {
    // Replace /api prefix with configured apiPrefix
    if (apiPrefix && requestConfig.url) {
      // Replace /api/ or /api at the start of the URL
      if (requestConfig.url.startsWith("/api/")) {
        requestConfig.url = requestConfig.url.replace("/api/", `${apiPrefix}/`);
      } else if (requestConfig.url.startsWith("/api")) {
        requestConfig.url = requestConfig.url.replace("/api", apiPrefix);
      }
    }

    // Add auth header if token is provided
    if (authToken) {
      requestConfig.headers.Authorization = `Bearer ${authToken}`;
    }

    return requestConfig;
  });

  return client;
}

export function ApiConfigProvider({
  children,
  apiPrefix = defaultConfig.apiPrefix,
  authToken = defaultConfig.authToken,
  baseUrl = defaultConfig.baseUrl,
}: ApiConfigProviderProps) {
  const config: ApiConfig = useMemo(
    () => ({ apiPrefix, authToken, baseUrl }),
    [apiPrefix, authToken, baseUrl],
  );

  const apiClient = useMemo(() => createApiClient(config), [config]);

  const contextValue: ApiConfigContextType = useMemo(
    () => ({
      ...config,
      apiClient,
    }),
    [config, apiClient],
  );

  return (
    <ApiConfigContext.Provider value={contextValue}>
      {children}
    </ApiConfigContext.Provider>
  );
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
 * When used outside ApiConfigProvider, returns default config with
 * standard axiosClient (for OSS backward compatibility).
 *
 * @returns ApiConfigContextType with apiPrefix, authToken, and apiClient
 */
export function useApiConfig(): ApiConfigContextType {
  const context = useContext(ApiConfigContext);
  // Return default config if outside provider (OSS mode)
  return context ?? defaultApiConfigContext;
}

/**
 * Hook to get the configured axios client.
 * Convenience wrapper around useApiConfig().apiClient
 *
 * @returns AxiosInstance configured with API prefix and auth token
 */
export function useApiClient(): AxiosInstance {
  return useApiConfig().apiClient;
}

/**
 * Safe version of useApiConfig that returns null if outside provider.
 * Useful for components that need to detect if ApiConfigProvider is present.
 */
export function useApiConfigSafe(): ApiConfigContextType | null {
  return useContext(ApiConfigContext);
}
