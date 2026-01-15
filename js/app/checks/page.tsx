"use client";

import { CheckPageContentOss } from "@datarecce/ui/components/check/CheckPageContentOss";
import { CheckPageLoadingOss } from "@datarecce/ui/components/check/CheckPageLoadingOss";
import React, { ReactNode, Suspense } from "react";

/**
 * Wrapper component that handles the Suspense boundary for useSearchParams
 */
export default function CheckPageWrapper(): ReactNode {
  return (
    <Suspense fallback={<CheckPageLoadingOss />}>
      <CheckPageContentOss />
    </Suspense>
  );
}
