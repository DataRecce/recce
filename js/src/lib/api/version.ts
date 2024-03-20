import { useState, useEffect } from "react";
import { axiosClient } from "./axiosClient";

export function useVersionNumber() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    async function fetchVersion() {
      try {
        const response = await axiosClient.get("/api/version");
        setVersion(response.data);
      } catch (error) {
        console.error("Error fetching version number:", error);
      }
    }

    fetchVersion();
  }, []);

  return version;
}

export interface ContextInfo {
  adapterType: string;
}

export function useRecceContextInfo() {
  const [contextInfo, setContextInfo] = useState<ContextInfo>();

  useEffect(() => {
    async function fetchContextInfo() {
      try {
        const response = await axiosClient.get("/api/context_info");
        setContextInfo({
          adapterType: response.data.adapterType,
        });
      } catch (error) {
        console.error("Error fetching context info:", error);
      }
    }

    fetchContextInfo();
  }, []);

  return contextInfo;
}
