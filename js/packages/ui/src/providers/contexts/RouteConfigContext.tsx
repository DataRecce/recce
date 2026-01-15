"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

/**
 * Route Configuration for path prefix customization.
 *
 * This context allows cloud consumers to configure a base path prefix
 * for all navigation within OSS components.
 *
 * Default behavior (OSS):
 * - basePath: "" (uses absolute paths like /query, /checks)
 *
 * Cloud usage example:
 * - basePath: "/oss/abc123" or "/preview/abc123"
 * - Navigation to "/query" becomes "/oss/abc123/query"
 */

/**
 * Route configuration interface
 */
export interface RouteConfig {
  /**
   * Base path prefix for navigation.
   * For OSS: "" (empty string, uses absolute paths like /query)
   * For Cloud: "/oss/<sessionId>" or "/preview/<sessionId>"
   */
  basePath: string;
}

/**
 * Context value with path resolution utility
 */
export interface RouteConfigContextType extends RouteConfig {
  /**
   * Resolves a path with the base path prefix.
   * @param path - The path to resolve (e.g., "/query")
   * @returns The resolved path (e.g., "/oss/abc123/query")
   */
  resolvePath: (path: string) => string;
}

const defaultConfig: RouteConfig = {
  basePath: "",
};

const RouteConfigContext = createContext<RouteConfigContextType | null>(null);
RouteConfigContext.displayName = "RouteConfigContext";

/**
 * Props for RouteConfigProvider
 */
export interface RouteConfigProviderProps extends Partial<RouteConfig> {
  children: ReactNode;
}

/**
 * Provider for route configuration.
 *
 * Wrap your application (or RecceContextProvider) with this provider
 * to configure path prefixes for navigation.
 *
 * @example
 * ```tsx
 * // In cloud application
 * <RouteConfigProvider basePath={`/oss/${sessionId}`}>
 *   <RecceContextProvider>
 *     {children}
 *   </RecceContextProvider>
 * </RouteConfigProvider>
 * ```
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

      // Handle absolute URLs (http://, https://, etc.) - don't prefix
      if (path.match(/^https?:\/\//)) {
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

  const contextValue: RouteConfigContextType = useMemo(
    () => ({
      basePath,
      resolvePath,
    }),
    [basePath, resolvePath],
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
};

/**
 * Hook to access route configuration.
 *
 * When used outside RouteConfigProvider, returns default config
 * (for OSS backward compatibility).
 *
 * @returns RouteConfigContextType with basePath and resolvePath function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { basePath, resolvePath } = useRouteConfig();
 *   const fullPath = resolvePath('/checks');
 *   // In cloud with basePath="/oss/abc123": "/oss/abc123/checks"
 *   // In OSS with basePath="": "/checks"
 * }
 * ```
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
