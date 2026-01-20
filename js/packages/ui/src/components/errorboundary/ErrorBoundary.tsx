import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {
  FallbackRender,
  ErrorBoundary as SentryErrorBoundary,
} from "@sentry/react";
import * as React from "react";
import { ReactNode } from "react";
import { useThemeColors } from "../../hooks";

/**
 * Fallback component that renders when an error is caught.
 * Uses useThemeColors for theme-aware styling.
 */
function FallbackComponent({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  const { background, text } = useThemeColors();

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
          p: 4,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          bgcolor: "background.paper",
          border: "solid 1px",
          borderColor: "divider",
          minHeight: "200px",
        }}
      >
        <Typography variant="h6" sx={{ width: "800px" }}>
          You have encountered an error
        </Typography>

        <Box sx={{ flex: 1, fontSize: "10pt", color: text.secondary }}>
          {String(error)}
        </Box>

        <Button
          sx={{
            justifySelf: "center",
            alignSelf: "center",
            mt: "20px",
          }}
          color="iochmara"
          variant="contained"
          size="small"
          onClick={resetError}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
}

/**
 * Wrapper function that converts the component to Sentry's FallbackRender format.
 */
const Fallback: FallbackRender = (errorData) => {
  return (
    <FallbackComponent
      error={errorData.error as Error}
      resetError={errorData.resetError}
    />
  );
};

export const ErrorBoundary = ({
  children,
  fallback = Fallback,
}: {
  children: ReactNode;
  fallback?: React.ReactElement | FallbackRender | undefined;
}) => {
  return (
    <SentryErrorBoundary fallback={fallback}>{children}</SentryErrorBoundary>
  );
};
