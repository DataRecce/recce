import { useState, useEffect } from "react";
import { axiosClient } from "./axiosClient";

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
        const responseData = (await axiosClient.get("/api/version")).data as VersionResponse;

        const version = responseData.version;
        const latestVersion = responseData.latestVersion;

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
