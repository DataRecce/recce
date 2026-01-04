/**
 * Next.js App Router Error Boundary
 *
 * This file handles runtime errors within route segments.
 * It automatically wraps the route segment in a React Error Boundary.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

"use client";

import { useThemeColors } from "@datarecce/ui/hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: https://nextjs.org/docs/app/api-reference/file-conventions/error
export default function Error({ error, reset }: ErrorProps) {
  const { background, border, text } = useThemeColors();

  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: "app",
        digest: error.digest,
      },
      extra: {
        componentStack: error.stack,
      },
    });

    // Also log to console for development
    console.error("App Error Boundary caught error:", error);
  }, [error]);

  return (
    <Box
      sx={{
        height: "100%",
        bgcolor: background.subtle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          bgcolor: background.paper,
          border: "solid 1px",
          borderColor: border.light,
          borderRadius: "8px",
          minHeight: "200px",
          boxShadow: 3,
        }}
      >
        <Typography variant="h6" sx={{ width: "800px", mb: 2 }}>
          You have encountered an error
        </Typography>

        <Box sx={{ flex: 1, fontSize: "10pt", color: text.secondary, mb: 2 }}>
          {error.message || String(error)}
        </Box>

        {error.digest && (
          <Box sx={{ fontSize: "9pt", color: text.disabled, mb: 2 }}>
            Error ID: {error.digest}
          </Box>
        )}

        <Button
          sx={{ justifySelf: "center", alignSelf: "center", mt: "20px" }}
          color="iochmara"
          variant="contained"
          size="small"
          onClick={() => {
            // Attempt to recover by re-rendering the route segment
            reset();
          }}
        >
          Try again
        </Button>
      </Box>
    </Box>
  );
}
