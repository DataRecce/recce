import { RecceInstanceInfoProvider } from "@datarecce/ui/contexts";
import {
  QueryContextAdapter,
  RecceShareStateContextProvider,
} from "@datarecce/ui/hooks";
import React from "react";
import { CheckContextAdapter } from "./CheckContextAdapter";
import { LineageGraphAdapter } from "./LineageGraphAdapter";
import { RecceActionAdapter } from "./RecceActionAdapter";

interface RecceContextProps {
  children: React.ReactNode;
}

/**
 * Main context provider for Recce application.
 *
 * For custom API configuration (e.g., recce-cloud), wrap this provider
 * with ApiConfigProvider:
 *
 * ```tsx
 * <ApiConfigProvider
 *   apiPrefix="/api/v2/sessions/abc123"
 *   authToken="eyJ..."
 * >
 *   <RecceContextProvider>
 *     {children}
 *   </RecceContextProvider>
 * </ApiConfigProvider>
 * ```
 *
 * When used without ApiConfigProvider (OSS mode), hooks will use
 * the default axios client with standard /api/* endpoints.
 */
export default function RecceContextProvider({ children }: RecceContextProps) {
  return (
    <RecceInstanceInfoProvider>
      <RecceShareStateContextProvider>
        <QueryContextAdapter>
          <LineageGraphAdapter>
            <RecceActionAdapter>
              <CheckContextAdapter>{children}</CheckContextAdapter>
            </RecceActionAdapter>
          </LineageGraphAdapter>
        </QueryContextAdapter>
      </RecceShareStateContextProvider>
    </RecceInstanceInfoProvider>
  );
}
