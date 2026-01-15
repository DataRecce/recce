/**
 * Next.js Global Error Boundary
 *
 * This file handles errors in the root layout.tsx.
 * It must include its own <html> and <body> tags since it replaces
 * the root layout when active.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */

"use client";

import { colors } from "@datarecce/ui/theme";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check localStorage (next-themes storage) or system preference
    // This is needed because global-error renders its own <html> outside of providers
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const dark =
      stored === "dark" ||
      (stored === "system" && prefersDark) ||
      (!stored && prefersDark);
    setIsDark(dark);
  }, []);

  useEffect(() => {
    // Log the error to Sentry with high priority
    Sentry.captureException(error, {
      level: "fatal",
      tags: {
        errorBoundary: "global",
        digest: error.digest,
      },
      extra: {
        componentStack: error.stack,
      },
    });

    console.error("Global Error Boundary caught error:", error);
  }, [error]);

  // Theme-aware colors
  const themeColors = {
    outerBg: isDark ? colors.neutral[900] : colors.neutral[50],
    cardBg: isDark ? colors.neutral[800] : colors.white,
    border: isDark ? colors.neutral[700] : colors.neutral[200],
    heading: isDark ? colors.neutral[50] : colors.neutral[900],
    bodyText: isDark ? colors.neutral[400] : colors.neutral[600],
    mutedText: isDark ? colors.neutral[500] : colors.neutral[400],
    shadow: isDark ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.1)",
  };

  return (
    <html lang="en" className={isDark ? "dark" : ""}>
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            backgroundColor: themeColors.outerBg,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              padding: "2rem",
              backgroundColor: themeColors.cardBg,
              border: `1px solid ${themeColors.border}`,
              borderRadius: "8px",
              maxWidth: "600px",
              boxShadow: `0 4px 6px ${themeColors.shadow}`,
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "1rem",
                color: themeColors.heading,
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: "0.875rem",
                color: themeColors.bodyText,
                marginBottom: "1rem",
              }}
            >
              {error.message || "An unexpected error occurred"}
            </p>

            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: themeColors.mutedText,
                  marginBottom: "1.5rem",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: colors.iochmara[500],
                color: colors.white,
                border: "none",
                borderRadius: "4px",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
