import { Badge, Code, Link, Text } from "@chakra-ui/react";
import React, { useEffect, useMemo } from "react";
import { toaster } from "@/components/ui/toaster";
import { useVersionNumber } from "@/lib/api/version";

export default function RecceVersionBadge() {
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
              Please run <Code>pip install --upgrade recce</Code> to update
              Recce.
              <br />
              <Link
                color="brand.700"
                fontWeight={"bold"}
                href={`https://github.com/DataRecce/recce/releases/tag/v${latestVersion}`}
                _hover={{ textDecoration: "underline" }}
                target="_blank"
              >
                Click here to view the detail of latest release
              </Link>
            </span>
          ),
          duration: 60 * 1000,
          // TODO Fix this at a later update
          // containerStyle: {
          //   background: "rgba(20, 20, 20, 0.6)", // Semi-transparent black
          //   color: "white", // Ensure text is visible
          //   backdropFilter: "blur(10px)", // Frosted glass effect
          //   borderRadius: "8px",
          // },
          closable: true,
        });
        sessionStorage.setItem(storageKey, "true");
      }, 0);
    }
  }, [version, latestVersion, versionFormatRegex]);

  if (!versionFormatRegex.test(version)) {
    // If the version is not in the format of x.y.z, don't apply
    return (
      <Badge
        fontSize="sm"
        color="white/80"
        variant="outline"
        textTransform="uppercase"
      >
        {version}
      </Badge>
    );
  }

  // Link to the release page on GitHub if the version is in the format of x.y.z
  return (
    <Badge
      fontSize="sm"
      color="white/80"
      variant="outline"
      textTransform="uppercase"
    >
      <Link
        href={`https://github.com/DataRecce/recce/releases/tag/v${version}`}
        _hover={{ textDecoration: "none" }}
      >
        <Text color="white/80">{version}</Text>
      </Link>
    </Badge>
  );
}
