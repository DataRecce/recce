"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PiInfo } from "react-icons/pi";

import type { RecceFeatureToggles } from "../../contexts/instance";

/**
 * Props for the SetupConnectionBanner component.
 *
 * Uses dependency injection for context dependencies to enable reuse
 * across different applications (OSS Recce, Recce Cloud).
 */
export interface SetupConnectionBannerProps {
  /**
   * Feature toggles from RecceInstanceContext.
   * Used to determine if banner should be shown (metadata only mode).
   */
  featureToggles: RecceFeatureToggles;

  /**
   * URL to open when user clicks "Connect to Data Warehouse" button.
   * Injected because URL generation varies by application context.
   */
  settingsUrl: string;
}

/**
 * Banner component that prompts users to set up a data warehouse connection.
 *
 * Displays when the Recce instance is in "metadata only" mode, indicating
 * that query functions are disabled without a data warehouse connection.
 *
 * @example
 * ```tsx
 * import { SetupConnectionBanner } from "@datarecce/ui";
 *
 * function MyComponent() {
 *   const { featureToggles } = useRecceInstanceContext();
 *   const { data: instanceInfo } = useRecceInstanceInfo();
 *   const settingsUrl = getSettingsUrl(instanceInfo);
 *
 *   return (
 *     <SetupConnectionBanner
 *       featureToggles={featureToggles}
 *       settingsUrl={settingsUrl}
 *     />
 *   );
 * }
 * ```
 */
export function SetupConnectionBanner({
  featureToggles,
  settingsUrl,
}: SetupConnectionBannerProps) {
  if (featureToggles.mode !== "metadata only") {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        px: 1,
        py: 0.25,
        bgcolor: "cyan.50",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ flex: 1, fontSize: "0.875rem", color: "cyan.600" }}
        spacing={1}
      >
        <Box component={PiInfo} />
        <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
          Query functions disabled without a data warehouse connection.
        </Typography>
        <Button
          sx={{ bgcolor: "iochmara.400" }}
          size="small"
          variant="contained"
          onClick={() => {
            window.open(settingsUrl, "_blank");
          }}
        >
          Connect to Data Warehouse
        </Button>
      </Stack>
    </Box>
  );
}

export default SetupConnectionBanner;
