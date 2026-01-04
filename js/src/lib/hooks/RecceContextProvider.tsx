import { RecceInstanceInfoProvider } from "@datarecce/ui/contexts";
import React from "react";
import { CheckContextAdapter } from "./CheckContextAdapter";
import { LineageGraphAdapter } from "./LineageGraphAdapter";
import { QueryContextAdapter } from "./QueryContextAdapter";
import { RecceActionAdapter } from "./RecceActionAdapter";
import { RowCountStateContextProvider } from "./RecceQueryContext";
import { RecceShareStateContextProvider } from "./RecceShareStateContext";

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
            <RowCountStateContextProvider>
              <RecceActionAdapter>
                <CheckContextAdapter>{children}</CheckContextAdapter>
              </RecceActionAdapter>
            </RowCountStateContextProvider>
          </LineageGraphAdapter>
        </QueryContextAdapter>
      </RecceShareStateContextProvider>
    </RecceInstanceInfoProvider>
  );
}
