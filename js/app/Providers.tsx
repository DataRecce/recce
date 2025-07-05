"use client";

import { ReactNode } from "react";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <Provider forcedTheme="light">
      <QueryClientProvider client={reactQueryClient}>
        <Router hook={useHashLocation}>
          <RecceContextProvider>
            {children}
            <Toaster />
          </RecceContextProvider>
        </Router>
      </QueryClientProvider>
    </Provider>
  );
}
