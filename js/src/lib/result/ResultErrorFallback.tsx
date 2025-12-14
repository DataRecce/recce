import { Alert } from "@/components/ui/mui";
import { FallbackRender } from "@sentry/react";
import * as React from "react";

const ResultErrorFallback: FallbackRender = (errorData) => {
  return (
    <Alert.Root status="error" title="You have encountered an error">
      <Alert.Indicator />
      <Alert.Title>{String(errorData.error)}</Alert.Title>
    </Alert.Root>
  );
};

export default ResultErrorFallback;
