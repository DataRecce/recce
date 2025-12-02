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
import { ReactNode, useEffect, useState } from "react";

/**
 * Module-level state to track hashbang check across component mounts.
 * This ensures we only check once per page load, even if the component
 * re-mounts due to Next.js navigation.
 */
let globalHashbangCheckComplete = false;
let globalHashbangPath: string | null = null;

// Perform the check immediately on module load (client-side only)
if (typeof window !== "undefined") {
  const hash = window.location.hash;
  const hashbangMatch = hash.match(/^#!(.*)$/);
  if (hashbangMatch) {
    const path = hashbangMatch[1];
    globalHashbangPath = path.startsWith("/") ? path : `/${path}`;
  }
  // Mark check as complete after first evaluation
  // (will be set to true after redirect or if no hashbang)
}

interface HashbangRedirectProps {
  /** Content to show while checking for redirect */
  fallback?: ReactNode;
  /** Children to render after redirect check completes */
  children: ReactNode;
}

export function HashbangRedirect({
  fallback,
  children,
}: HashbangRedirectProps): ReactNode {
  const router = useRouter();
  const [isReady, setIsReady] = useState(globalHashbangCheckComplete);

  useEffect(() => {
    // If check was already completed (e.g., component re-mounted), skip
    if (globalHashbangCheckComplete) {
      setIsReady(true);
      return;
    }

    // If there's a hashbang path, redirect
    if (globalHashbangPath) {
      router.replace(globalHashbangPath);
      // Don't set ready - let the redirect happen
      // The new page will mount fresh with globalHashbangCheckComplete = true
      globalHashbangCheckComplete = true;
      return;
    }

    // No hashbang - mark as complete and show children
    globalHashbangCheckComplete = true;
    setIsReady(true);
  }, [router]);

  // Only show fallback on initial load when we haven't completed the check
  if (!isReady) {
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
  // Return the cached result from module initialization
  return {
    isHashbang: globalHashbangPath !== null,
    hashbangPath: globalHashbangPath,
  };
}

/**
 * Reset the hashbang check state.
 * Only use this for testing purposes.
 */
export function resetHashbangCheck(): void {
  globalHashbangCheckComplete = false;
  globalHashbangPath = null;
}
