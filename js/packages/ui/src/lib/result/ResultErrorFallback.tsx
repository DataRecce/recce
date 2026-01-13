import MuiAlert from "@mui/material/Alert";
import type { FallbackRender } from "@sentry/react";
import * as React from "react";

const ResultErrorFallback: FallbackRender = (errorData) => {
  return <MuiAlert severity="error">{String(errorData.error)}</MuiAlert>;
};

export default ResultErrorFallback;
