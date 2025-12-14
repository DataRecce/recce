/**
 * Application Providers
 *
 * Wraps the application with necessary context providers.
 * Updated to remove Wouter Router - now using Next.js App Router.
 *
 * Migration Note: Both Chakra UI (Provider) and MUI (MuiProvider) are included
 * to support the gradual migration from Chakra to MUI. Once migration is
 * complete, the Chakra Provider can be removed.
 */

"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { MuiProvider } from "@/components/ui/mui-provider";
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
      <MuiProvider forcedTheme="light">
        <QueryClientProvider client={reactQueryClient}>
          <IdleTimeoutProvider>
            <RecceContextProvider>
              <MainLayout lineage={lineage}>{children}</MainLayout>
              <Toaster />
            </RecceContextProvider>
          </IdleTimeoutProvider>
        </QueryClientProvider>
      </MuiProvider>
    </Provider>
  );
}
