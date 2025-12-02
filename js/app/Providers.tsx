/**
 * Application Providers
 *
 * Wraps the application with necessary context providers.
 * Updated to remove Wouter Router - now using Next.js App Router.
 */

"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { HashbangRedirect } from "@/components/routing/HashbangRedirect";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { IdleTimeoutProvider } from "@/lib/hooks/IdleTimeoutContext";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { MainLayout } from "./MainLayout";

interface ProvidersProps {
  children: ReactNode;
  /** Parallel route slot for lineage page */
  lineage: ReactNode;
}

export default function Providers({ children, lineage }: ProvidersProps) {
  return (
    <Provider forcedTheme="light">
      <QueryClientProvider client={reactQueryClient}>
        <IdleTimeoutProvider>
          <RecceContextProvider>
            <MainLayout lineage={lineage}>{children}</MainLayout>
            <Toaster />
          </RecceContextProvider>
        </IdleTimeoutProvider>
      </QueryClientProvider>
    </Provider>
  );
}
