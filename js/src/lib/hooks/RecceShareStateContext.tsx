/**
 * @recce-migration NOT_APPLICABLE
 *
 * This context is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Share state functionality is tied to OSS-specific local state management
 * and export features. It manages the share URL generation and state serialization
 * that is unique to the OSS deployment model.
 *
 * If this changes in the future, consider:
 * - Moving to @datarecce/ui if share functionality becomes cross-platform
 * - Creating an abstract interface for different share backends
 */

import { shareState } from "@datarecce/ui/api";
import React, { createContext, useContext, useState } from "react";
import { useApiConfig } from "./ApiConfigContext";

interface ShareStateProps {
  shareUrl?: string;
  isLoading: boolean;
  error?: string;
  handleShareClick: () => Promise<void>;
}

const ShareState = createContext<ShareStateProps | undefined>(undefined);

export function RecceShareStateContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shareUrl, setShareUrl] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { apiClient } = useApiConfig();

  const handleShareClick = async () => {
    setIsLoading(true);
    setError(undefined);
    setShareUrl(undefined);
    try {
      const response = await shareState(apiClient);
      if (response.status !== "success") {
        setError(response.message);
        return;
      }
      setShareUrl(response.share_url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ShareState.Provider
      value={{ shareUrl, isLoading, error, handleShareClick }}
    >
      {children}
    </ShareState.Provider>
  );
}

export const useRecceShareStateContext = () => {
  const context = useContext(ShareState);
  if (!context) {
    throw new Error(
      "useRecceShareStateContext must be used within a RecceShareStateContextProvider",
    );
  }
  return context;
};
