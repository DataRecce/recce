"use client";

import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React, { useState } from "react";
import { IconType } from "react-icons";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { VscGitPullRequest } from "react-icons/vsc";
import {
  useLineageGraphContext,
  useRecceInstanceContext,
} from "../../contexts";
import { colors } from "../../theme";
import { IdleTimeoutBadge } from "../timeout/IdleTimeoutBadge";
import AuthModal from "./AuthModal";
import AvatarDropdown from "./AvatarDropdown";
import { DisplayModeToggleOss as DisplayModeToggle } from "./DisplayModeToggleOss";
import { RecceVersionBadgeOss as RecceVersionBadge } from "./RecceVersionBadgeOss";

interface LinkIconProps {
  icon: IconType;
  href: string;
  sx?: object;
}

function LinkIcon({ icon: IconComponent, href, sx, ...props }: LinkIconProps) {
  const theme = useTheme();
  return (
    <Link
      sx={{ height: "20px", color: "common.white", ...sx }}
      href={href}
      target="_blank"
      {...props}
    >
      <IconComponent
        style={{ color: theme.palette.common.white, width: 20, height: 20 }}
      />
    </Link>
  );
}

export const TopBarOss = () => {
  const { reviewMode, isDemoSite, envInfo, cloudMode } =
    useLineageGraphContext();
  const { featureToggles, authed } = useRecceInstanceContext();
  const { url: prURL, id: prID } = envInfo?.pullRequest ?? {};
  const demoPrId = prURL ? prURL.split("/").pop() : null;
  const brandLink =
    cloudMode || authed
      ? "https://cloud.datarecce.io/"
      : "https://reccehq.com/";
  const [showModal, setShowModal] = useState(false);

  return (
    <Box
      sx={{
        display: "flex",
        gap: "10px",
        minHeight: "40px",
        alignItems: "center",
        bgcolor: colors.brand[400],
      }}
    >
      <Link
        href={brandLink}
        target="_blank"
        sx={{ "&:hover": { textDecoration: "none" } }}
      >
        <Box sx={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Box
            component="img"
            sx={{ width: 20, height: 20, ml: "18px" }}
            src="/logo/recce-logo-white.png"
            alt="recce-logo-white"
          />
          <Typography
            variant="h4"
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              color: "common.white",
              fontSize: "1.25rem",
            }}
          >
            RECCE
          </Typography>
        </Box>
      </Link>
      <DisplayModeToggle />
      <RecceVersionBadge />
      {(featureToggles.mode ?? reviewMode) && (
        <Badge
          sx={{
            fontSize: "0.875rem",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderWidth: 1,
            px: 1,
            borderRadius: 0.75,
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          {featureToggles.mode ?? "review mode"}
        </Badge>
      )}
      {cloudMode && prID && (
        <Badge
          sx={{
            fontSize: "0.875rem",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderWidth: 1,
            px: 1,
            borderRadius: 0.75,
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box>cloud mode</Box>
            <Box
              sx={{
                borderLeft: "1px solid rgba(255,255,255,0.8)",
                pl: "8px",
              }}
            >
              <Link
                href={prURL}
                sx={{ "&:hover": { textDecoration: "none" } }}
                target="_blank"
              >
                <VscGitPullRequest
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    width: 12,
                    height: 12,
                    marginRight: 2,
                    display: "inline",
                    verticalAlign: "middle",
                  }}
                />
                <Typography
                  component="span"
                  sx={{ color: "rgba(255,255,255,0.8)", display: "inline" }}
                >{`#${String(prID)}`}</Typography>
              </Link>
            </Box>
          </Stack>
        </Badge>
      )}
      {isDemoSite && prURL && demoPrId && (
        <Badge
          sx={{
            fontSize: "0.875rem",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderWidth: 1,
            px: 1,
            borderRadius: 0.75,
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box>demo mode</Box>
            <Box
              sx={{
                borderLeft: "1px solid rgba(255,255,255,0.8)",
                pl: "8px",
              }}
            >
              <Link
                href={prURL}
                sx={{ "&:hover": { textDecoration: "none" } }}
                target="_blank"
              >
                <VscGitPullRequest
                  style={{
                    color: "rgba(255,255,255,0.8)",
                    width: 12,
                    height: 12,
                    marginRight: 2,
                    display: "inline",
                    verticalAlign: "middle",
                  }}
                />
                <Typography
                  component="span"
                  sx={{ color: "rgba(255,255,255,0.8)", display: "inline" }}
                >{`#${demoPrId}`}</Typography>
              </Link>
            </Box>
          </Stack>
        </Badge>
      )}
      <Box sx={{ flex: 1 }} />

      {(isDemoSite || featureToggles.mode === "read only") && (
        <>
          <LinkIcon icon={FaGithub} href="https://github.com/DataRecce/recce" />
          <LinkIcon
            icon={FaSlack}
            href="https://getdbt.slack.com/archives/C05C28V7CPP"
          />
          <LinkIcon
            sx={{ mr: 2 }}
            icon={FaQuestionCircle}
            href="https://docs.reccehq.com"
          />
        </>
      )}
      {!isDemoSite && featureToggles.mode !== "read only" && (
        <>
          <IdleTimeoutBadge />
          {authed || cloudMode ? (
            <Box sx={{ mr: 2 }}>
              <AvatarDropdown />
            </Box>
          ) : (
            <>
              <Box
                component="button"
                sx={{
                  color: "common.white",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  bgcolor: "brand.700",
                  borderRadius: 1,
                  px: 3,
                  py: 1,
                  mr: 2,
                  cursor: "pointer",
                  border: "none",
                }}
                onClick={() => {
                  setShowModal(true);
                }}
              >
                Connect to Cloud
              </Box>
              {showModal && (
                <AuthModal
                  parentOpen={showModal}
                  handleParentClose={setShowModal}
                  ignoreCookie
                  variant="user-profile"
                />
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};
