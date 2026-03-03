"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RiMindMap, RiTerminalBoxLine } from "react-icons/ri";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Props for BaseEnvironmentSetupGuide component.
 * Uses dependency injection for external URLs to support different consumers.
 */
export interface BaseEnvironmentSetupGuideProps {
  /**
   * URL to navigate to when "Start Now" button is clicked.
   * @default "https://docs.reccehq.com/get-started/#prepare-dbt-artifacts"
   */
  docsUrl?: string;
  /**
   * Callback when the "Start Now" button is clicked.
   * If provided, will be called instead of opening the URL.
   */
  onStartClick?: () => void;
}

/**
 * Props for BaseEnvironmentSetupNotification component.
 * Uses dependency injection for external URLs to support different consumers.
 */
export interface BaseEnvironmentSetupNotificationProps {
  /**
   * URL for the documentation link.
   * @default "https://docs.reccehq.com/configure-diff/"
   */
  docsUrl?: string;
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * BaseEnvironmentSetupGuide Component
 *
 * Full-page guide displayed when Recce is running in single environment mode
 * (limited functionality mode). Explains the benefits of setting up a base
 * environment and provides a call-to-action to configure it.
 *
 * @example
 * ```tsx
 * import { BaseEnvironmentSetupGuide } from '@datarecce/ui/components/lineage';
 *
 * // Default usage with standard docs URL
 * <BaseEnvironmentSetupGuide />
 *
 * // Custom docs URL for different consumer
 * <BaseEnvironmentSetupGuide
 *   docsUrl="https://cloud.reccehq.com/docs/setup"
 * />
 *
 * // Custom click handler
 * <BaseEnvironmentSetupGuide
 *   onStartClick={() => navigateToSetup()}
 * />
 * ```
 */
export function BaseEnvironmentSetupGuide({
  docsUrl = "https://docs.reccehq.com/get-started/#prepare-dbt-artifacts",
  onStartClick,
}: BaseEnvironmentSetupGuideProps = {}) {
  const handleStartClick = () => {
    if (onStartClick) {
      onStartClick();
    } else {
      window.open(docsUrl, "_blank");
    }
  };

  return (
    <Stack
      sx={{
        flex: 1,
        height: "100%",
        minHeight: 0,
        m: 1,
        p: 2,
        bgcolor: "iochmara.50",
        borderRadius: 2,
        boxShadow: 2,
        justifyContent: "center",
      }}
    >
      <Stack
        sx={{ width: "80%", overflowY: "auto", gap: 3, px: 4, pb: 4 }}
        alignSelf="center"
      >
        <Stack alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              bgcolor: "background.paper",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: 2,
            }}
          >
            <Box
              component={RiTerminalBoxLine}
              sx={{ fontSize: 28, color: "iochmara.500" }}
            />
          </Box>
          <Typography variant="h5" sx={{ mt: 2 }}>
            Wait, there's more!
          </Typography>
          <Typography sx={{ textAlign: "center" }}>
            Recce is currently running in{" "}
            <Typography component="span" sx={{ fontWeight: "bold" }}>
              limited functionality mode
            </Typography>{" "}
            so you can run queries but{" "}
            <Typography component="span" sx={{ fontWeight: "bold" }}>
              can't diff the results yet!
            </Typography>
          </Typography>
        </Stack>
        <Stack spacing={1}>
          <Typography>
            To unlock the full power of Recce, set up a base environment of dbt
            artifacts for comparison.
          </Typography>
          <Typography>Once configured, you'll be able to:</Typography>
          <List sx={{ listStyleType: "disc", pl: 2 }}>
            <ListItem sx={{ display: "list-item", p: 0 }}>
              <Typography>Run statistical data diffs</Typography>
            </ListItem>
            <ListItem sx={{ display: "list-item", p: 0 }}>
              <Typography>Run query diffs</Typography>
            </ListItem>
            <ListItem sx={{ display: "list-item", p: 0 }}>
              <Typography>Save checks to your Recce Checklist</Typography>
            </ListItem>
            <ListItem sx={{ display: "list-item", p: 0 }}>
              <Typography>...and more!</Typography>
            </ListItem>
          </List>
          <Typography>
            Take the next step toward better data impact assessment.
          </Typography>
        </Stack>
        <Stack sx={{ width: "100%", mt: 3 }}>
          <Button
            color="iochmara"
            variant="contained"
            size="large"
            onClick={handleStartClick}
          >
            Start Now
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

/**
 * BaseEnvironmentSetupNotification Component
 *
 * Compact notification/banner component displayed in the lineage view sidebar
 * when in single environment mode. Provides quick guidance on how to set up
 * full environment comparison.
 *
 * @example
 * ```tsx
 * import { BaseEnvironmentSetupNotification } from '@datarecce/ui/components/lineage';
 *
 * // Default usage with standard docs URL
 * <BaseEnvironmentSetupNotification />
 *
 * // Custom docs URL for different consumer
 * <BaseEnvironmentSetupNotification
 *   docsUrl="https://cloud.reccehq.com/docs/configure"
 * />
 * ```
 */
export function BaseEnvironmentSetupNotification({
  docsUrl = "https://docs.reccehq.com/configure-diff/",
}: BaseEnvironmentSetupNotificationProps = {}) {
  return (
    <Stack direction="row" spacing="10px" alignItems="flex-start">
      <Box
        component={RiMindMap}
        sx={{ color: "iochmara.main", fontSize: 20 }}
      />
      <Stack spacing="5px">
        <Typography sx={{ fontWeight: 700 }}>
          Single Environment Mode{" "}
          <Typography
            component="span"
            sx={{ color: "error.main", fontWeight: 600 }}
          >
            Limited Functionality
          </Typography>
        </Typography>

        <Typography sx={{ fontSize: "0.875rem" }}>
          Single Environment Mode allows you to explore your dbt project but
          won't show data comparisons between environments.
        </Typography>
        <Typography sx={{ fontSize: "0.875rem" }}>
          To set up full environment comparison:
        </Typography>
        <List sx={{ pl: 2 }}>
          <ListItem sx={{ p: 0, display: "list-item" }}>
            <Typography sx={{ fontSize: "0.875rem" }}>
              Run `recce debug` for setup assistance
            </Typography>
          </ListItem>
          <ListItem sx={{ p: 0, display: "list-item" }}>
            <Typography sx={{ fontSize: "0.875rem" }}>
              Visit{" "}
              <Link
                sx={{ color: "primary.main", fontWeight: 500 }}
                target="_blank"
                href={docsUrl}
              >
                docs
              </Link>{" "}
              for configuration details
            </Typography>
          </ListItem>
        </List>
      </Stack>
    </Stack>
  );
}
