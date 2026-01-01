"use client";

import axios, { type AxiosInstance } from "axios";
import { createContext, type ReactNode, useContext, useMemo } from "react";

interface ApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ApiContextValue {
  client: AxiosInstance;
}

const ApiContext = createContext<ApiContextValue | null>(null);

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

export function ApiProvider({ children, config }: ApiProviderProps) {
  const client = useMemo(() => {
    if ("client" in config) {
      return config.client;
    }
    return axios.create({
      baseURL: config.baseUrl,
      headers: config.headers,
      timeout: config.timeout ?? 30000,
    });
  }, [config]);

  return (
    <ApiContext.Provider value={{ client }}>{children}</ApiContext.Provider>
  );
}
