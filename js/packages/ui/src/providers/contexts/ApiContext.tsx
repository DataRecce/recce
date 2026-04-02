"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";
import { type ApiClient, createFetchClient } from "../../lib/fetchClient";

/**
 * API Configuration
 *
 * baseUrl: Base URL for all requests
 * apiPrefix: Replaces /api in URLs (for cloud mode sessions)
 * authToken: Bearer token for Authorization header
 * headers: Additional headers
 * timeout: Request timeout in ms
 */
/**
 * API configuration inputs for {@link ApiProvider}.
 */
interface ApiConfig {
  baseUrl: string;
  apiPrefix?: string;
  authToken?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Resolved API context values exposed by {@link useApiConfig}.
 */
interface ApiContextValue {
  apiClient: ApiClient;
  apiPrefix: string;
  authToken?: string;
  baseUrl: string;
}

const ApiContext = createContext<ApiContextValue | null>(null);
ApiContext.displayName = "RecceApiContext";

/**
 * Access the API configuration, including the configured API client.
 *
 * @returns The API context values (client, baseUrl, apiPrefix, authToken).
 * @throws Error if used outside {@link RecceProvider}.
 */
export function useApiConfig(): ApiContextValue {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("useApiConfig must be used within RecceProvider");
  }
  return context;
}

/**
 * Non-throwing version of {@link useApiConfig}.
 *
 * @returns The API context values, or null if outside {@link RecceProvider}.
 */
export function useApiConfigOptional(): ApiContextValue | null {
  return useContext(ApiContext);
}

/**
 * Convenience hook for the configured API client.
 *
 * @returns ApiClient configured with API prefix and auth token.
 * @throws Error if used outside {@link RecceProvider}.
 */
export function useApiClient() {
  return useApiConfig().apiClient;
}

/**
 * Custom client config that allows passing a pre-configured API client
 * along with the API configuration values for context.
 */
/**
 * Custom client configuration for {@link ApiProvider}.
 */
interface CustomClientConfig {
  client: ApiClient;
  apiPrefix?: string;
  authToken?: string;
  baseUrl?: string;
}

/**
 * Props for {@link ApiProvider}.
 */
interface ApiProviderProps {
  children: ReactNode;
  config: ApiConfig | CustomClientConfig;
}

// Hook to memoize headers by value (JSON comparison) instead of reference
function useStableHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  const headersRef = useRef(headers);
  const keyRef = useRef(headers ? JSON.stringify(headers) : "");

  const currentKey = headers ? JSON.stringify(headers) : "";
  if (currentKey !== keyRef.current) {
    headersRef.current = headers;
    keyRef.current = currentKey;
  }

  return headersRef.current;
}

/**
 * Creates an ApiClient configured with the given API config.
 *
 * Uses middleware to:
 * 1. Replace /api prefix with the configured apiPrefix (if provided)
 * 2. Add Authorization header with Bearer token (if authToken provided)
 */
function createApiClient(
  baseUrl: string,
  apiPrefix: string,
  authToken: string | undefined,
  headers: Record<string, string> | undefined,
  timeout: number,
): ApiClient {
  return createFetchClient({
    baseURL: baseUrl,
    headers: headers,
    timeout: timeout,
    middleware:
      apiPrefix || authToken
        ? (url, init) => {
            try {
              let resolvedUrl = url;

              // Replace /api prefix with configured apiPrefix (only if apiPrefix is non-empty).
              // Uses string ops instead of new URL() to handle both absolute URLs
              // (cloud mode with baseURL) and relative paths (OSS mode with baseURL="").
              if (apiPrefix) {
                // Find the /api path segment — could be at start of path (relative)
                // or after the origin (absolute). We match both patterns.
                const apiExact = resolvedUrl.endsWith("/api")
                  ? resolvedUrl.lastIndexOf("/api")
                  : -1;
                const apiSlash = resolvedUrl.indexOf("/api/");

                if (apiExact >= 0) {
                  // Exact "/api" at end of URL
                  resolvedUrl = resolvedUrl.slice(0, apiExact) + apiPrefix;
                } else if (apiSlash >= 0) {
                  // "/api/..." — replace /api with apiPrefix, keep the rest
                  resolvedUrl =
                    resolvedUrl.slice(0, apiSlash) +
                    apiPrefix +
                    resolvedUrl.slice(apiSlash + 4);
                }
              }

              // Add auth header if token is provided
              if (authToken) {
                init.headers.set("Authorization", `Bearer ${authToken}`);
              }

              return { url: resolvedUrl, init };
            } catch (error) {
              // If anything goes wrong in the middleware, fall back to the original config
              // to avoid breaking all API requests.
              console.warn(
                "API request middleware error, proceeding with unmodified request:",
                error,
              );
              return { url, init };
            }
          }
        : undefined,
  });
}

/**
 * Provides API configuration and an API client to the subtree.
 */
export function ApiProvider({ children, config }: ApiProviderProps) {
  // Extract primitive values to stabilize dependency - prevents client recreation
  // when parent re-renders with new object reference but same values
  const isCustomClient = "client" in config;
  const customClient = isCustomClient ? config.client : null;
  const baseUrl = isCustomClient ? (config.baseUrl ?? "") : config.baseUrl;
  const timeout = !isCustomClient ? config.timeout : undefined;
  const headersFromConfig = !isCustomClient ? config.headers : undefined;
  const apiPrefix = config.apiPrefix ?? "";
  const authToken = config.authToken;

  // Use stable headers reference (compared by value, not reference)
  const headers = useStableHeaders(headersFromConfig);

  const client = useMemo(() => {
    if (customClient) {
      return customClient;
    }
    return createApiClient(
      baseUrl,
      apiPrefix,
      authToken,
      headers,
      timeout ?? 30000,
    );
  }, [customClient, baseUrl, apiPrefix, authToken, headers, timeout]);

  const contextValue: ApiContextValue = useMemo(
    () => ({
      apiClient: client,
      apiPrefix,
      authToken,
      baseUrl,
    }),
    [client, apiPrefix, authToken, baseUrl],
  );

  return (
    <ApiContext.Provider value={contextValue}>{children}</ApiContext.Provider>
  );
}
