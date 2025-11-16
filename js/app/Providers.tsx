"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Router } from "wouter";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { reactQueryClient } from "@/lib/api/axiosClient";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { useHashLocation } from "@/lib/hooks/useHashLocation";

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
