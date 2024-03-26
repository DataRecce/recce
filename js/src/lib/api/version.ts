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
