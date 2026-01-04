import { RecceInstanceInfoProvider } from "@datarecce/ui/contexts";
import React from "react";
import { LineageGraphAdapter } from "./LineageGraphAdapter";
import { RecceActionAdapter } from "./RecceActionAdapter";
import { RecceCheckContextProvider } from "./RecceCheckContext";
import {
  RecceQueryContextProvider,
  RowCountStateContextProvider,
} from "./RecceQueryContext";
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
        <RecceQueryContextProvider>
          <LineageGraphAdapter>
            <RowCountStateContextProvider>
              <RecceActionAdapter>
                <RecceCheckContextProvider>
                  {children}
                </RecceCheckContextProvider>
              </RecceActionAdapter>
            </RowCountStateContextProvider>
          </LineageGraphAdapter>
        </RecceQueryContextProvider>
      </RecceShareStateContextProvider>
    </RecceInstanceInfoProvider>
  );
}
