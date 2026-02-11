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
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ReactNode } from "react";
import { ApiProvider, IdleTimeoutProvider } from "../../contexts";
import { RecceContextProvider } from "../../hooks";
import { reactQueryClient } from "../../lib/api/axiosClient";
import { PUBLIC_API_URL } from "../../lib/const";
import { MuiProvider, Toaster } from "../ui";
import { MainLayout } from "./MainLayout";

interface ProvidersProps {
  children: ReactNode;
  /** Parallel route slot for lineage page */
  lineage: ReactNode;
}

export default function Providers({ children, lineage }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
    >
      <MuiProvider enableCssBaseline>
        <QueryClientProvider client={reactQueryClient}>
          <ApiProvider config={{ baseUrl: PUBLIC_API_URL }}>
            <IdleTimeoutProvider>
              <RecceContextProvider>
                <MainLayout lineage={lineage}>{children}</MainLayout>
                <Toaster />
              </RecceContextProvider>
            </IdleTimeoutProvider>
          </ApiProvider>
        </QueryClientProvider>
      </MuiProvider>
    </NextThemesProvider>
  );
}
