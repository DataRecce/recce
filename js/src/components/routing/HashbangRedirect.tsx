/**
 * HashbangRedirect - Client-side redirect for legacy hashbang URLs
 *
 * This component detects URLs with #! (hashbang) fragments and redirects
 * them to the standard Next.js routing paths.
 *
 * Example: /#!/lineage -> /lineage
 *
 * This is necessary because hash fragments are not sent to the server,
 * so server-side proxy/middleware cannot handle them.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface HashbangRedirectProps {
  /** Content to show while checking for redirect */
  fallback?: React.ReactNode;
  /** Children to render after redirect check completes */
  children: React.ReactNode;
}

/**
 * Parses a hashbang URL and extracts the path
 * @param hash - The window.location.hash value
 * @returns The path without the hashbang prefix, or null if not a hashbang URL
 */
function parseHashbangPath(hash: string): string | null {
  // Match #!/ followed by the path
  const hashbangMatch = hash.match(/^#!(.*)$/);
  if (hashbangMatch) {
    const path = hashbangMatch[1];
    // Ensure path starts with /
    return path.startsWith("/") ? path : `/${path}`;
  }
  return null;
}

export function HashbangRedirect({
  fallback,
  children,
}: HashbangRedirectProps): React.ReactNode {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      setIsChecking(false);
      return;
    }

    const hash = window.location.hash;
    const hashbangPath = parseHashbangPath(hash);

    if (hashbangPath) {
      // Redirect to the new path without hashbang
      // Use replace to avoid adding to browser history
      router.replace(hashbangPath);
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Show fallback while checking/redirecting
  if (isChecking) {
    return fallback ?? null;
  }

  return children;
}

/**
 * Hook to detect if current URL has a hashbang
 * Useful for conditional logic without the redirect behavior
 */
export function useHashbangDetection(): {
  isHashbang: boolean;
  hashbangPath: string | null;
} {
  const [state, setState] = useState<{
    isHashbang: boolean;
    hashbangPath: string | null;
  }>({
    isHashbang: false,
    hashbangPath: null,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = parseHashbangPath(window.location.hash);
      setState({
        isHashbang: path !== null,
        hashbangPath: path,
      });
    }
  }, []);

  return state;
}
