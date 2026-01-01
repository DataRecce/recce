"use client";

import axios, { type AxiosInstance } from "axios";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from "react";

interface ApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ApiContextValue {
  client: AxiosInstance;
}

const ApiContext = createContext<ApiContextValue | null>(null);
ApiContext.displayName = "RecceApiContext";

export function useApiClient(): AxiosInstance {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error("useApiClient must be used within RecceProvider");
  }
  return context.client;
}

interface ApiProviderProps {
  children: ReactNode;
  config: ApiConfig | { client: AxiosInstance };
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

export function ApiProvider({ children, config }: ApiProviderProps) {
  // Extract primitive values to stabilize dependency - prevents axios instance recreation
  // when parent re-renders with new object reference but same values
  const isCustomClient = "client" in config;
  const customClient = isCustomClient ? config.client : null;
  const baseUrl = !isCustomClient ? config.baseUrl : "";
  const timeout = !isCustomClient ? config.timeout : undefined;
  const headersFromConfig = !isCustomClient ? config.headers : undefined;

  // Use stable headers reference (compared by value, not reference)
  const headers = useStableHeaders(headersFromConfig);

  const client = useMemo(() => {
    if (customClient) {
      return customClient;
    }
    return axios.create({
      baseURL: baseUrl,
      headers: headers,
      timeout: timeout ?? 30000,
    });
  }, [customClient, baseUrl, headers, timeout]);

  return (
    <ApiContext.Provider value={{ client }}>{children}</ApiContext.Provider>
  );
}
