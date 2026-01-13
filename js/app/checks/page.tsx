"use client";

import React, { ReactNode, Suspense } from "react";
import CheckPageContent from "@/components/check/CheckPageContent";
import CheckPageLoading from "@/components/check/CheckPageLoading";

/**
 * Wrapper component that handles the Suspense boundary for useSearchParams
 */
export default function CheckPageWrapper(): ReactNode {
  return (
    <Suspense fallback={<CheckPageLoading />}>
      <CheckPageContent />
    </Suspense>
  );
}
