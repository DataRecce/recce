"use client";

import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiConfigOptional } from "../providers/contexts/ApiContext";

const defaultApiClient = axios.create();

export interface VersionResponse {
  version: string;
  latestVersion: string;
}

export async function getVersion(
  client: AxiosInstance,
): Promise<VersionResponse> {
  const response = await client.get<never, AxiosResponse<VersionResponse>>(
    "/api/version",
  );
  return response.data;
}

export function useVersionNumber() {
  const [version, setVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const apiConfig = useApiConfigOptional();
  const apiClient = apiConfig?.apiClient ?? defaultApiClient;

  useEffect(() => {
    async function fetchVersion() {
      try {
        const { version, latestVersion } = await getVersion(apiClient);

        setVersion(version);
        setLatestVersion(latestVersion);
      } catch (error) {
        console.error("Error fetching version number:", error);
      }
    }
    void fetchVersion();
  }, [apiClient]);

  return { version, latestVersion };
}
