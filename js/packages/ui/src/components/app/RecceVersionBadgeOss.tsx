import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import React, { useEffect, useMemo } from "react";
import { useVersionNumber } from "../../api";
import { toaster } from "../ui";

export const RecceVersionBadgeOss = () => {
  const { version, latestVersion } = useVersionNumber();
  const versionFormatRegex = useMemo(
    () => new RegExp("^\\d+\\.\\d+\\.\\d+$"),
    [],
  );

  useEffect(() => {
    if (versionFormatRegex.test(version) && version !== latestVersion) {
      const storageKey = "recce-update-toast-shown";
      const hasShownForThisVersion = sessionStorage.getItem(storageKey);
      if (hasShownForThisVersion) {
        return;
      }
      // Defer toast creation to next tick to avoid React's flushSync error
      // This prevents "flushSync called from inside lifecycle method" when
      // the toast library tries to immediately update DOM during render cycle
      setTimeout(() => {
        toaster.create({
          id: "recce-update-available", // Fixed ID prevents duplicates
          title: "Update available",
          description: (
            <span>
              A new version of Recce (v{latestVersion}) is available.
              <br />
              Please run{" "}
              <Box
                component="code"
                sx={{
                  bgcolor: "grey.200",
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  fontFamily: "monospace",
                  fontSize: "0.875em",
                }}
              >
                pip install --upgrade recce
              </Box>{" "}
              to update Recce.
              <br />
              <Link
                sx={{
                  color: "primary.main",
                  fontWeight: "bold",
                  "&:hover": { textDecoration: "underline" },
                }}
                href={`https://github.com/DataRecce/recce/releases/tag/v${latestVersion}`}
                target="_blank"
              >
                Click here to view the detail of latest release
              </Link>
            </span>
          ),
          duration: 60 * 1000,
          closable: true,
        });
        sessionStorage.setItem(storageKey, "true");
      }, 0);
    }
  }, [version, latestVersion, versionFormatRegex]);

  if (!versionFormatRegex.test(version)) {
    // If the version is not in the format of x.y.z, don't apply
    return (
      <Typography
        component="span"
        sx={{
          fontSize: "sm",
          color: "rgba(255,255,255,0.8)",
          textTransform: "uppercase",
          borderWidth: 1,
          px: 1,
          borderRadius: 0.75,
        }}
      >
        {version}
      </Typography>
    );
  }

  // Link to the release page on GitHub if the version is in the format of x.y.z
  return (
    <Link
      href={`https://github.com/DataRecce/recce/releases/tag/v${version}`}
      sx={{
        "&:hover": { textDecoration: "none" },
        fontSize: "sm",
        color: "rgba(255,255,255,0.8)",
        textTransform: "uppercase",
        borderWidth: 1,
        px: 1,
        borderRadius: 0.75,
      }}
      target="_blank"
    >
      {version}
    </Link>
  );
};
