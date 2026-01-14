/**
 * useAppRouter - Navigation utilities for Next.js App Router
 *
 * Provides a similar API to Wouter's useLocation for easier migration.
 * This hook combines Next.js's useRouter, usePathname, useParams,
 * and useSearchParams into a unified interface.
 *
 * IMPORTANT: useSearchParams() triggers Suspense boundaries in Next.js.
 * To avoid full-page loading states, useAppLocation() only returns the
 * pathname by default. Use useAppLocationWithSearch() if you need
 * search params included in the location string.
 *
 * RouteConfigContext Integration:
 * When RouteConfigProvider is used (e.g., in recce-cloud), navigation
 * paths are automatically prefixed with the configured basePath.
 * For example, setLocation("/query") becomes "/oss/abc123/query".
 */

"use client";

import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useCallback, useMemo } from "react";
import { useRouteConfig } from "./RouteConfigContext";

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

/**
 * Hook that provides Wouter-compatible location API using Next.js App Router
 * with RouteConfigContext support for path prefixing.
 *
 * NOTE: This returns only the pathname (not search params) to avoid
 * triggering Suspense boundaries on every navigation.
 *
 * @returns [pathname, setLocation] tuple similar to Wouter's useLocation
 *
 * @example
 * const [location, setLocation] = useAppLocation();
 * setLocation("/checks?id=123"); // Navigate to new path with query
 * setLocation("/checks", { replace: true }); // Replace current history entry
 *
 * // With RouteConfigProvider basePath="/oss/abc123":
 * setLocation("/query"); // Navigates to "/oss/abc123/query"
 */
export function useAppLocation(): [
  string,
  (to: string, options?: NavigateOptions) => void,
] {
  const router = useRouter();
  const rawPathname = usePathname();
  const { resolvePath, stripBasePath } = useRouteConfig();

  // Strip basePath from pathname so components receive logical paths
  // e.g., "/oss/abc123/checks" becomes "/checks"
  const pathname = useMemo(
    () => stripBasePath(rawPathname),
    [rawPathname, stripBasePath],
  );

  // Navigation function compatible with Wouter's setLocation
  // Automatically applies basePath prefix from RouteConfigContext
  const setLocation = useCallback(
    (to: string, options?: NavigateOptions) => {
      // Separate path, query string, and fragment for proper handling
      // Use indexOf to split only on the first occurrence
      let pathAndQuery = to;
      let hashPart = "";

      const hashIndex = to.indexOf("#");
      if (hashIndex !== -1) {
        pathAndQuery = to.slice(0, hashIndex);
        hashPart = to.slice(hashIndex); // includes the '#'
      }

      let pathPart = pathAndQuery;
      let queryPart = "";
      const queryIndex = pathAndQuery.indexOf("?");
      if (queryIndex !== -1) {
        pathPart = pathAndQuery.slice(0, queryIndex);
        queryPart = pathAndQuery.slice(queryIndex + 1);
      }

      const resolvedPath = resolvePath(pathPart);
      let fullPath = resolvedPath;
      if (queryPart) {
        fullPath += `?${queryPart}`;
      }
      if (hashPart) {
        fullPath += hashPart;
      }

      if (options?.replace) {
        router.replace(fullPath, { scroll: options?.scroll ?? true });
      } else {
        router.push(fullPath, { scroll: options?.scroll ?? true });
      }
    },
    [router, resolvePath],
  );

  return [pathname, setLocation];
}

/**
 * Hook that includes search params in the location string.
 * Also supports RouteConfigContext path prefixing.
 *
 * WARNING: This hook uses useSearchParams() which triggers Suspense.
 * Only use this in components that are wrapped in a <Suspense> boundary,
 * or in leaf components where suspension is acceptable.
 *
 * @returns [fullLocation, setLocation] tuple with search params included
 */
export function useAppLocationWithSearch(): [
  string,
  (to: string, options?: NavigateOptions) => void,
] {
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvePath, stripBasePath } = useRouteConfig();

  // Strip basePath from pathname so components receive logical paths
  const pathname = useMemo(
    () => stripBasePath(rawPathname),
    [rawPathname, stripBasePath],
  );

  // Construct full location string including search params
  const location = useMemo(() => {
    const search = searchParams?.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  // Navigation function with RouteConfigContext support
  const setLocation = useCallback(
    (to: string, options?: NavigateOptions) => {
      // Separate path, query string, and fragment for proper handling
      // Use indexOf to split only on the first occurrence
      let pathAndQuery = to;
      let hashPart = "";

      const hashIndex = to.indexOf("#");
      if (hashIndex !== -1) {
        pathAndQuery = to.slice(0, hashIndex);
        hashPart = to.slice(hashIndex); // includes the '#'
      }

      let pathPart = pathAndQuery;
      let queryPart = "";
      const queryIndex = pathAndQuery.indexOf("?");
      if (queryIndex !== -1) {
        pathPart = pathAndQuery.slice(0, queryIndex);
        queryPart = pathAndQuery.slice(queryIndex + 1);
      }

      const resolvedPath = resolvePath(pathPart);
      let fullPath = resolvedPath;
      if (queryPart) {
        fullPath += `?${queryPart}`;
      }
      if (hashPart) {
        fullPath += hashPart;
      }

      if (options?.replace) {
        router.replace(fullPath, { scroll: options?.scroll ?? true });
      } else {
        router.push(fullPath, { scroll: options?.scroll ?? true });
      }
    },
    [router, resolvePath],
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
  const rawPathname = usePathname();
  const params = useParams();
  const { stripBasePath } = useRouteConfig();

  // Strip basePath from pathname so route matching works with logical paths
  const pathname = useMemo(
    () => stripBasePath(rawPathname),
    [rawPathname, stripBasePath],
  );

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
 * navigateTo("/checks?id=123");
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
 * Provides direct access to Next.js router methods with RouteConfigContext support
 *
 * NOTE: Does not include searchParams to avoid Suspense.
 * Use useSearchParams() directly in components that need it.
 */
export function useAppNavigation() {
  const router = useRouter();
  const rawPathname = usePathname();
  const params = useParams();
  const { resolvePath, stripBasePath } = useRouteConfig();

  // Strip basePath from pathname so components receive logical paths
  const pathname = useMemo(
    () => stripBasePath(rawPathname),
    [rawPathname, stripBasePath],
  );

  // Helper to build resolved href with proper path/query/fragment handling
  const buildResolvedHref = useCallback(
    (href: string): string => {
      // Separate fragment (hash) from the rest of the URL
      let pathAndQuery = href;
      let hashPart = "";

      const hashIndex = href.indexOf("#");
      if (hashIndex !== -1) {
        pathAndQuery = href.slice(0, hashIndex);
        hashPart = href.slice(hashIndex); // includes the '#'
      }

      // Split only on the first "?" to separate path and query
      let pathPart = pathAndQuery;
      let queryPart = "";
      const queryIndex = pathAndQuery.indexOf("?");
      if (queryIndex !== -1) {
        pathPart = pathAndQuery.slice(0, queryIndex);
        queryPart = pathAndQuery.slice(queryIndex + 1);
      }

      const resolvedPath = resolvePath(pathPart);
      let fullPath = resolvedPath;
      if (queryPart) {
        fullPath += `?${queryPart}`;
      }
      if (hashPart) {
        fullPath += hashPart;
      }

      return fullPath;
    },
    [resolvePath],
  );

  // Wrap router.push and router.replace with path resolution
  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      const fullPath = buildResolvedHref(href);
      router.push(fullPath, options);
    },
    [router, buildResolvedHref],
  );

  const replace = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      const fullPath = buildResolvedHref(href);
      router.replace(fullPath, options);
    },
    [router, buildResolvedHref],
  );

  return {
    /** Current pathname */
    pathname,
    /** Current route params */
    params: params as Record<string, string>,
    /** Navigate to a new path (with RouteConfigContext support) */
    push,
    /** Replace current history entry (with RouteConfigContext support) */
    replace,
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
