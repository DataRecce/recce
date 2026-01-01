"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { type ReactNode } from "react";

import { ApiProvider } from "./contexts/ApiContext";
import { RoutingProvider } from "./contexts/RoutingContext";
import { ThemeProvider } from "./contexts/ThemeContext";

type ThemeMode = "light" | "dark" | "system";

interface RecceProviderProps {
  children: ReactNode;

  /** API configuration - simple config OR custom client */
  api:
    | {
        baseUrl: string;
        headers?: Record<string, string>;
        timeout?: number;
      }
    | {
        client: AxiosInstance;
      };

  /** Theme mode. Default: "system" */
  theme?: ThemeMode;

  /** Routing configuration for path prefixing */
  routing?: {
    basePath?: string;
  };

  /** TanStack Query client configuration */
  queryClient?: {
    staleTime?: number;
    gcTime?: number;
  };

  /** Action overrides (escape hatches) */
  actions?: {
    onShowHistory?: () => void;
    onExportCheck?: (checkId: string) => void;
  };

  /** Feature flags */
  features?: {
    enableLineage?: boolean;
    enableProfiling?: boolean;
    enableQueryEditor?: boolean;
  };
}

// Create a default query client
const createDefaultQueryClient = (
  options?: RecceProviderProps["queryClient"],
) =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: options?.staleTime ?? 1000 * 60, // 1 minute
        gcTime: options?.gcTime ?? 1000 * 60 * 5, // 5 minutes
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

export function RecceProvider({
  children,
  api,
  theme = "system",
  routing,
  queryClient: queryClientConfig,
  actions,
  features,
}: RecceProviderProps) {
  const queryClient = createDefaultQueryClient(queryClientConfig);

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider config={api}>
        <ThemeProvider defaultMode={theme}>
          <RoutingProvider config={routing}>{children}</RoutingProvider>
        </ThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export type { RecceProviderProps };
