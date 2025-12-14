import {
  FallbackRender,
  ErrorBoundary as SentryErrorBoundary,
} from "@sentry/react";
import * as React from "react";
import { ReactNode, useState } from "react";
import { Box, Button, Center, Flex, Heading } from "@/components/ui/mui";

const Fallback: FallbackRender = (errorData) => {
  return (
    <Center sx={{ height: "100%", bgcolor: "grey.50" }}>
      <Flex
        sx={{
          p: 4,
          flexDirection: "column",
          justifyContent: "flex-start",
          bgcolor: "white",
          border: "solid lightgray 1px",
          minHeight: "200px",
        }}
      >
        <Heading sx={{ width: "800px" }} size="md">
          You have encountered an error
        </Heading>

        <Box sx={{ flex: 1, fontSize: "10pt" }}>{String(errorData.error)}</Box>

        <Button
          sx={{
            justifySelf: "center",
            alignSelf: "center",
            mt: "20px",
          }}
          colorPalette="iochmara"
          size="sm"
          onClick={() => {
            errorData.resetError();
          }}
        >
          Reset
        </Button>
      </Flex>
    </Center>
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
