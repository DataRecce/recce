"use client";

import React, { createContext, useCallback, useContext, useMemo } from "react";

/**
 * Route Configuration for path prefix customization.
 *
 * This context allows recce-cloud to configure a base path prefix
 * for all navigation within Recce components.
 *
 * Default behavior (OSS):
 * - basePath: "" (uses absolute paths like /query, /checks)
 *
 * Cloud usage example:
 * - basePath: "/oss/abc123" or "/preview/abc123"
 * - Navigation to "/query" becomes "/oss/abc123/query"
 */

export interface RouteConfig {
  /**
   * Base path prefix for navigation.
   * For OSS: "" (empty string, uses absolute paths like /query)
   * For Cloud: "/oss/<sessionId>" or "/preview/<sessionId>"
   */
  basePath: string;
}

export interface RouteConfigContextType extends RouteConfig {
  /**
   * Resolves a path with the base path prefix.
   * @param path - The path to resolve (e.g., "/query")
   * @returns The resolved path (e.g., "/oss/abc123/query")
   */
  resolvePath: (path: string) => string;

  /**
   * Strips the base path prefix from a pathname.
   * Used to normalize pathnames for route matching.
   * @param pathname - The full pathname (e.g., "/oss/abc123/query")
   * @returns The logical path without prefix (e.g., "/query")
   */
  stripBasePath: (pathname: string) => string;
}

const defaultConfig: RouteConfig = {
  basePath: "",
};

const RouteConfigContext = createContext<RouteConfigContextType | null>(null);

interface RouteConfigProviderProps extends Partial<RouteConfig> {
  children: React.ReactNode;
}

/**
 * Provider for route configuration.
 *
 * Wrap your application (or RecceContextProvider) with this provider
 * to configure path prefixes for navigation.
 *
 * @example
 * // In recce-cloud
 * <RouteConfigProvider basePath={`/oss/${sessionId}`}>
 *   <RecceContextProvider>
 *     {children}
 *   </RecceContextProvider>
 * </RouteConfigProvider>
 */
export function RouteConfigProvider({
  children,
  basePath = defaultConfig.basePath,
}: RouteConfigProviderProps) {
  const resolvePath = useCallback(
    (path: string): string => {
      // If no basePath configured, return path as-is (OSS mode)
      if (!basePath) {
        return path;
      }

      // Handle paths that already start with the basePath (avoid double-prefixing)
      if (path.startsWith(basePath)) {
        return path;
      }

      // Handle absolute URLs with any valid scheme (http://, mailto:, tel:, etc.) - don't prefix
      if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
        return path;
      }

      // Handle hash-only paths - don't prefix
      if (path.startsWith("#")) {
        return path;
      }

      // Ensure proper joining (no double slashes)
      const cleanBasePath = basePath.endsWith("/")
        ? basePath.slice(0, -1)
        : basePath;
      const cleanPath = path.startsWith("/") ? path : `/${path}`;

      return `${cleanBasePath}${cleanPath}`;
    },
    [basePath],
  );

  const stripBasePath = useCallback(
    (pathname: string): string => {
      // If no basePath configured, return pathname as-is (OSS mode)
      if (!basePath) {
        return pathname;
      }

      // Normalize basePath (remove trailing slash if present)
      const cleanBasePath = basePath.endsWith("/")
        ? basePath.slice(0, -1)
        : basePath;

      // If pathname starts with basePath, strip it
      if (pathname.startsWith(cleanBasePath)) {
        const stripped = pathname.slice(cleanBasePath.length);
        // Ensure we return a path starting with "/" or "/" if empty
        return stripped || "/";
      }

      // If pathname doesn't start with basePath, return as-is
      return pathname;
    },
    [basePath],
  );

  const contextValue: RouteConfigContextType = useMemo(
    () => ({
      basePath,
      resolvePath,
      stripBasePath,
    }),
    [basePath, resolvePath, stripBasePath],
  );

  return (
    <RouteConfigContext.Provider value={contextValue}>
      {children}
    </RouteConfigContext.Provider>
  );
}

// Default context for OSS mode (no prefix)
const defaultRouteConfigContext: RouteConfigContextType = {
  basePath: "",
  resolvePath: (path: string) => path,
  stripBasePath: (pathname: string) => pathname,
};

/**
 * Hook to access route configuration.
 *
 * When used outside RouteConfigProvider, returns default config
 * (for OSS backward compatibility).
 *
 * @returns RouteConfigContextType with basePath and resolvePath function
 */
export function useRouteConfig(): RouteConfigContextType {
  const context = useContext(RouteConfigContext);
  // Return default config if outside provider (OSS mode)
  return context ?? defaultRouteConfigContext;
}

/**
 * Safe hook that returns null if context not available.
 * Useful for components that need to detect if RouteConfigProvider is present.
 */
export function useRouteConfigSafe(): RouteConfigContextType | null {
  return useContext(RouteConfigContext);
}
