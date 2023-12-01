import { useState, useEffect } from "react";
import axios from "axios";


export function useVersionNumber() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    async function fetchVersion() {
      try {
        const response = await axios.get("/api/version");
        setVersion(response.data);
      } catch (error) {
        console.error("Error fetching version number:", error);
      }
    }

    fetchVersion();
  }, []);

  return version;
}
