import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {
  FallbackRender,
  ErrorBoundary as SentryErrorBoundary,
} from "@sentry/react";
import * as React from "react";
import { ReactNode, useState } from "react";

const Fallback: FallbackRender = (errorData) => {
  return (
    <Box
      sx={{
        height: "100%",
        bgcolor: "grey.50",
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
          bgcolor: "white",
          border: "solid lightgray 1px",
          minHeight: "200px",
        }}
      >
        <Typography variant="h6" sx={{ width: "800px" }}>
          You have encountered an error
        </Typography>

        <Box sx={{ flex: 1, fontSize: "10pt" }}>{String(errorData.error)}</Box>

        <Button
          sx={{
            justifySelf: "center",
            alignSelf: "center",
            mt: "20px",
          }}
          color="iochmara"
          variant="contained"
          size="small"
          onClick={() => {
            errorData.resetError();
          }}
        >
          Reset
        </Button>
      </Box>
    </Box>
  );
};

/* For testing purposes only */
// noinspection JSUnusedGlobalSymbols
export const ErrorButton = () => {
  const [a, setA] = useState<{ foo: string } | undefined>({ foo: "bar" });

  return (
    <Button
      sx={{ position: "absolute", zIndex: 1 }}
      onClick={() => {
        setA(undefined);
      }}
    >
      {a?.foo}
    </Button>
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
