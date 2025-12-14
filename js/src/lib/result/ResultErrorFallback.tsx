import { FallbackRender } from "@sentry/react";
import * as React from "react";
import { Alert } from "@/components/ui/mui";

const ResultErrorFallback: FallbackRender = (errorData) => {
  return (
    <Alert.Root status="error" title="You have encountered an error">
      <Alert.Indicator />
      <Alert.Title>{String(errorData.error)}</Alert.Title>
    </Alert.Root>
  );
};

export default ResultErrorFallback;
