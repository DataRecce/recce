"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

interface RoutingConfig {
  basePath?: string;
}

interface RoutingContextValue {
  basePath: string;
  buildPath: (path: string) => string;
}

const RoutingContext = createContext<RoutingContextValue | null>(null);
RoutingContext.displayName = "RecceRoutingContext";

export function useRouting(): RoutingContextValue {
  const context = useContext(RoutingContext);
  if (!context) {
    // Return sensible defaults if not within provider
    return {
      basePath: "",
      buildPath: (path: string) => path,
    };
  }
  return context;
}

interface RoutingProviderProps {
  children: ReactNode;
  config?: RoutingConfig;
}

export function RoutingProvider({ children, config }: RoutingProviderProps) {
  const value = useMemo(() => {
    const basePath = config?.basePath ?? "";
    return {
      basePath,
      buildPath: (path: string) => {
        if (!basePath) return path;
        return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
      },
    };
  }, [config?.basePath]);

  return (
    <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>
  );
}
