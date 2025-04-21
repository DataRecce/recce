import { useState, useEffect } from "react";
import { axiosClient } from "./axiosClient";
import { AxiosResponse } from "axios";

interface VersionResponse {
  version: string;
  latestVersion: string;
}

export function useVersionNumber() {
  const [version, setVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");

  useEffect(() => {
    async function fetchVersion() {
      try {
        const { version, latestVersion } = (
          await axiosClient.get<never, AxiosResponse<VersionResponse>>("/api/version")
        ).data;

        setVersion(version);
        setLatestVersion(latestVersion);
      } catch (error) {
        console.error("Error fetching version number:", error);
      }
    }
    void fetchVersion();
  }, []);

  return { version, latestVersion };
}
