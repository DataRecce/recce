"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

/**
 * Navigation options for route changes
 */
export interface NavigateOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** Scroll to top after navigation (default: true) */
  scroll?: boolean;
}

/**
 * Configuration for the routing provider
 */
export interface RoutingConfig {
  /** Base path prefix for all routes */
  basePath?: string;

  /**
   * Current pathname (provided by consumer's router)
   * If not provided, defaults to empty string
   */
  pathname?: string;

  /**
   * Navigation handler (provided by consumer's router)
   * Called when components need to navigate programmatically
   *
   * @example
   * ```tsx
   * // Next.js App Router
   * const router = useRouter();
   * <RecceProvider
   *   routing={{
   *     pathname: usePathname(),
   *     onNavigate: (path, options) => {
   *       options?.replace ? router.replace(path) : router.push(path);
   *     }
   *   }}
   * />
   * ```
   */
  onNavigate?: (path: string, options?: NavigateOptions) => void;
}

/**
 * Routing context value available to consumers
 */
export interface RoutingContextValue {
  /** Base path prefix */
  basePath: string;
  /** Build a full path with base path prefix */
  buildPath: (path: string) => string;
  /** Current pathname (if provided by consumer) */
  pathname: string;
  /** Navigate to a path */
  navigate: (path: string, options?: NavigateOptions) => void;
}

const RoutingContext = createContext<RoutingContextValue | null>(null);
RoutingContext.displayName = "RecceRoutingContext";

/**
 * Hook to access routing context
 *
 * @returns Routing context with path utilities and navigation
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { pathname, navigate, buildPath } = useRouting();
 *
 *   return (
 *     <button onClick={() => navigate(buildPath('/checks'))}>
 *       Go to Checks
 *     </button>
 *   );
 * }
 * ```
 */
export function useRouting(): RoutingContextValue {
  const context = useContext(RoutingContext);
  if (!context) {
    // Return sensible defaults if not within provider
    return {
      basePath: "",
      buildPath: (path: string) => path,
      pathname: "",
      navigate: (path: string) => {
        // Fallback: use window.location for navigation
        if (typeof window !== "undefined") {
          window.location.href = path;
        }
      },
    };
  }
  return context;
}

/**
 * Hook compatible with useAppLocation API
 *
 * Returns a tuple of [pathname, setLocation] for easy migration from
 * the OSS useAppLocation hook.
 *
 * @returns [pathname, navigate] tuple
 *
 * @example
 * ```tsx
 * const [location, setLocation] = useAppLocation();
 * setLocation('/checks?id=123');
 * setLocation('/checks', { replace: true });
 * ```
 */
export function useAppLocation(): [
  string,
  (path: string, options?: NavigateOptions) => void,
] {
  const { pathname, navigate } = useRouting();
  return [pathname, navigate];
}

interface RoutingProviderProps {
  children: ReactNode;
  config?: RoutingConfig;
}

export function RoutingProvider({ children, config }: RoutingProviderProps) {
  const basePath = config?.basePath ?? "";
  const pathname = config?.pathname ?? "";
  const onNavigate = config?.onNavigate;

  const buildPath = useCallback(
    (path: string) => {
      if (!basePath) return path;
      return `${basePath}${path.startsWith("/") ? path : `/${path}`}`;
    },
    [basePath],
  );

  const navigate = useCallback(
    (path: string, options?: NavigateOptions) => {
      if (onNavigate) {
        onNavigate(path, options);
      } else if (typeof window !== "undefined") {
        // Fallback: use window.location
        if (options?.replace) {
          window.history.replaceState(null, "", path);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } else {
          window.location.href = path;
        }
      }
    },
    [onNavigate],
  );

  const value = useMemo<RoutingContextValue>(
    () => ({
      basePath,
      buildPath,
      pathname,
      navigate,
    }),
    [basePath, buildPath, pathname, navigate],
  );

  return (
    <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>
  );
}
