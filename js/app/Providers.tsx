"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Router } from "wouter";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { IdleTimeoutProvider } from "@/lib/hooks/IdleTimeoutContext";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { useIdleDetection } from "@/lib/hooks/useIdleDetection";

function IdleDetector() {
  useIdleDetection();
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <Provider forcedTheme="light">
      <QueryClientProvider client={reactQueryClient}>
        <IdleTimeoutProvider>
          <IdleDetector />
          <Router hook={useHashLocation}>
            <RecceContextProvider>
              {children}
              <Toaster />
            </RecceContextProvider>
          </Router>
        </IdleTimeoutProvider>
      </QueryClientProvider>
    </Provider>
  );
}
