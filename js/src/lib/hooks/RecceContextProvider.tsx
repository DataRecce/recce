import React from "react";
import { type ApiConfig, ApiConfigProvider } from "./ApiConfigContext";
import { LineageGraphContextProvider } from "./LineageGraphContext";
import { RecceActionContextProvider } from "./RecceActionContext";
import { RecceCheckContextProvider } from "./RecceCheckContext";
import { RecceInstanceInfoProvider } from "./RecceInstanceContext";
import {
  RecceQueryContextProvider,
  RowCountStateContextProvider,
} from "./RecceQueryContext";
import { RecceShareStateContextProvider } from "./RecceShareStateContext";

interface RecceContextProps extends Partial<ApiConfig> {
  children: React.ReactNode;
}

/**
 * Main context provider for Recce application.
 *
 * @param apiPrefix - API endpoint prefix to replace `/api` in all requests.
 *                    For OSS: "" (empty, uses default /api/* paths)
 *                    For Cloud: "/api/v2/sessions/<session_id>"
 * @param authToken - Optional auth token for API requests (adds Bearer header)
 * @param baseUrl - Optional base URL override for API requests
 * @param children - Child components
 */
export default function RecceContextProvider({
  children,
  apiPrefix,
  authToken,
  baseUrl,
}: RecceContextProps) {
  return (
    <ApiConfigProvider
      apiPrefix={apiPrefix}
      authToken={authToken}
      baseUrl={baseUrl}
    >
      <RecceInstanceInfoProvider>
        <RecceShareStateContextProvider>
          <RecceQueryContextProvider>
            <LineageGraphContextProvider>
              <RowCountStateContextProvider>
                <RecceActionContextProvider>
                  <RecceCheckContextProvider>
                    {children}
                  </RecceCheckContextProvider>
                </RecceActionContextProvider>
              </RowCountStateContextProvider>
            </LineageGraphContextProvider>
          </RecceQueryContextProvider>
        </RecceShareStateContextProvider>
      </RecceInstanceInfoProvider>
    </ApiConfigProvider>
  );
}
