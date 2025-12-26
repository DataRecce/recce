import { AxiosInstance, AxiosResponse } from "axios";
import { useEffect, useState } from "react";
import { useApiConfig } from "../hooks/ApiConfigContext";
import { axiosClient } from "./axiosClient";

interface VersionResponse {
  version: string;
  latestVersion: string;
}

export async function getVersion(
  client: AxiosInstance = axiosClient,
): Promise<VersionResponse> {
  const response = await client.get<never, AxiosResponse<VersionResponse>>(
    "/api/version",
  );
  return response.data;
}

export function useVersionNumber() {
  const [version, setVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const { apiClient } = useApiConfig();

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
