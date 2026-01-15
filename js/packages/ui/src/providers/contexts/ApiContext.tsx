"use client";

import axios, { type AxiosInstance } from "axios";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";

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
  apiClient: AxiosInstance;
  apiPrefix: string;
  authToken?: string;
  baseUrl: string;
}

const ApiContext = createContext<ApiContextValue | null>(null);
ApiContext.displayName = "RecceApiContext";

/**
 * Access the API configuration, including the configured axios client.
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
 * Convenience hook for the configured axios client.
 *
 * @returns AxiosInstance configured with API prefix and auth token.
 * @throws Error if used outside {@link RecceProvider}.
 */
export function useApiClient(): AxiosInstance {
  return useApiConfig().apiClient;
}

/**
 * Custom client config that allows passing a pre-configured axios instance
 * along with the API configuration values for context.
 */
/**
 * Custom client configuration for {@link ApiProvider}.
 */
interface CustomClientConfig {
  client: AxiosInstance;
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
 * Creates an axios instance configured with the given API config.
 *
 * The instance has interceptors that:
 * 1. Replace /api prefix with the configured apiPrefix (if provided)
 * 2. Add Authorization header with Bearer token (if authToken provided)
 */
function createApiClient(
  baseUrl: string,
  apiPrefix: string,
  authToken: string | undefined,
  headers: Record<string, string> | undefined,
  timeout: number,
): AxiosInstance {
  const client = axios.create({
    baseURL: baseUrl,
    headers: headers,
    timeout: timeout,
  });

  // Only add interceptor if apiPrefix or authToken are provided
  if (apiPrefix || authToken) {
    client.interceptors.request.use(
      (requestConfig) => {
        try {
          // Replace /api prefix with configured apiPrefix (only if apiPrefix is non-empty)
          if (apiPrefix && requestConfig.url) {
            // Handle exact "/api" and "/api/*" URLs explicitly
            if (requestConfig.url === "/api") {
              requestConfig.url = apiPrefix;
            } else if (requestConfig.url.startsWith("/api/")) {
              // "/api".length === 4; keep everything after that
              requestConfig.url = apiPrefix + requestConfig.url.slice(4);
            }
          }

          // Add auth header if token is provided
          if (authToken) {
            requestConfig.headers.Authorization = `Bearer ${authToken}`;
          }

          return requestConfig;
        } catch (error) {
          // If anything goes wrong in the interceptor, fall back to the original config
          // to avoid breaking all API requests.
          console.warn(
            "API request interceptor error, proceeding with unmodified request:",
            error,
          );
          return requestConfig;
        }
      },
      (error) => {
        // Preserve default axios behavior for request errors
        return Promise.reject(error);
      },
    );
  }

  return client;
}

/**
 * Provides API configuration and an axios client to the subtree.
 */
export function ApiProvider({ children, config }: ApiProviderProps) {
  // Extract primitive values to stabilize dependency - prevents axios instance recreation
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
