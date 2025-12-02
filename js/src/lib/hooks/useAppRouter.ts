/**
 * useAppRouter - Navigation utilities for Next.js App Router
 *
 * Provides a similar API to Wouter's useLocation for easier migration.
 * This hook combines Next.js's useRouter, usePathname, useParams,
 * and useSearchParams into a unified interface.
 */

"use client";

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useMemo } from "react";

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

/**
 * Hook that provides Wouter-compatible location API using Next.js App Router
 *
 * @returns [location, setLocation] tuple similar to Wouter's useLocation
 *
 * @example
 * // Migration from Wouter
 * // Before: const [location, setLocation] = useLocation();
 * // After:  const [location, setLocation] = useAppLocation();
 *
 * const [location, setLocation] = useAppLocation();
 * setLocation("/checks/123"); // Navigate to new path
 * setLocation("/checks", { replace: true }); // Replace current history entry
 */
export function useAppLocation(): [
  string,
  (to: string, options?: NavigateOptions) => void,
] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Construct full location string including search params
  const location = useMemo(() => {
    const search = searchParams?.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  // Navigation function compatible with Wouter's setLocation
  const setLocation = useCallback(
    (to: string, options?: NavigateOptions) => {
      if (options?.replace) {
        router.replace(to, { scroll: options?.scroll ?? true });
      } else {
        router.push(to, { scroll: options?.scroll ?? true });
      }
    },
    [router],
  );

  return [location, setLocation];
}

/**
 * Hook to check if current path matches a pattern
 * Similar to Wouter's useRoute
 *
 * @param pattern - The route pattern to match (e.g., "/checks/:checkId")
 * @returns [isMatch, params] tuple
 *
 * @example
 * const [isMatch, params] = useAppRoute("/checks/:checkId");
 * if (isMatch) {
 *   console.log(params.checkId); // "abc-123"
 * }
 */
export function useAppRoute(
  pattern: string,
): [boolean, Record<string, string>] {
  const pathname = usePathname();
  const params = useParams();

  const isMatch = useMemo(() => {
    // Convert Next.js dynamic route pattern to regex
    // /checks/[checkId] -> /checks/:checkId -> /checks/([^/]+)
    const regexPattern = pattern
      .replace(/:\w+/g, "([^/]+)") // :param -> capture group
      .replace(/\*/g, ".*"); // * -> wildcard

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(pathname);
  }, [pattern, pathname]);

  // Convert Next.js params to plain object
  const paramsObj = useMemo(() => {
    if (!params) return {};
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        Array.isArray(value) ? value.join("/") : value,
      ]),
    );
  }, [params]);

  return [isMatch, paramsObj as Record<string, string>];
}

/**
 * Imperative navigation function for use outside React components
 * Use sparingly - prefer useAppLocation hook in components
 *
 * @example
 * // In an event handler or utility function
 * import { navigateTo } from "@/lib/hooks/useAppRouter";
 * navigateTo("/checks/123");
 */
export function navigateTo(path: string, replace = false): void {
  if (typeof window !== "undefined") {
    if (replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }
    // Trigger Next.js to recognize the navigation
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

/**
 * Hook for programmatic navigation with more options
 * Provides direct access to Next.js router methods
 */
export function useAppNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();

  return {
    /** Current pathname */
    pathname,
    /** Current route params */
    params: params as Record<string, string>,
    /** Current search params */
    searchParams,
    /** Navigate to a new path */
    push: router.push,
    /** Replace current history entry */
    replace: router.replace,
    /** Go back in history */
    back: router.back,
    /** Go forward in history */
    forward: router.forward,
    /** Refresh the current route */
    refresh: router.refresh,
    /** Prefetch a route for faster navigation */
    prefetch: router.prefetch,
  };
}

// Re-export Next.js hooks for convenience
export { useRouter, usePathname, useParams, useSearchParams };
