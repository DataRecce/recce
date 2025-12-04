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

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
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

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            backgroundColor: "#f7fafc",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              padding: "2rem",
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              maxWidth: "600px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "1rem",
                color: "#1a202c",
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: "0.875rem",
                color: "#4a5568",
                marginBottom: "1rem",
              }}
            >
              {error.message || "An unexpected error occurred"}
            </p>

            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#a0aec0",
                  marginBottom: "1.5rem",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#3182ce",
                color: "white",
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
