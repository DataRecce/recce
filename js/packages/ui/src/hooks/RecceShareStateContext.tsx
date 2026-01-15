import React, { createContext, useContext, useState } from "react";
import { shareState } from "../api";
import { useApiConfig } from "./useApiConfig";

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
