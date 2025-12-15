import { Badge } from "@mui/material";
import RecceVersionBadge from "app/(mainComponents)/RecceVersionBadge";
import React, { useState } from "react";
import { IconType } from "react-icons";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { VscGitPullRequest } from "react-icons/vsc";
import AuthModal from "@/components/AuthModal/AuthModal";
import AvatarDropdown from "@/components/app/AvatarDropdown";
import { IdleTimeoutBadge } from "@/components/timeout/IdleTimeoutBadge";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Image,
  Link,
  type LinkProps,
  Spacer,
  Text,
} from "@/components/ui/mui";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

interface LinkIconProps extends LinkProps {
  icon: IconType;
  href: string;
}

function LinkIcon({ icon: IconComponent, href, ...props }: LinkIconProps) {
  return (
    <Link
      sx={{ height: "20px", color: "white" }}
      href={href}
      target="_blank"
      {...props}
    >
      <IconComponent style={{ color: "white", width: 20, height: 20 }} />
    </Link>
  );
}

export default function TopBar() {
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
    <Flex
      sx={{
        gap: "10px",
        minHeight: "40px",
        alignItems: "center",
        bgcolor: "rgb(255, 110, 66)",
      }}
    >
      <Link
        href={brandLink}
        target="_blank"
        sx={{ "&:hover": { textDecoration: "none" } }}
      >
        <Flex sx={{ gap: "10px", alignItems: "center" }}>
          <Image
            sx={{ width: 20, height: 20, ml: "18px" }}
            src="/logo/recce-logo-white.png"
            alt="recce-logo-white"
          />
          <Heading
            as="h4"
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              color: "white",
            }}
          >
            RECCE
          </Heading>
        </Flex>
      </Link>
      <RecceVersionBadge />
      {(featureToggles.mode ?? reviewMode) && (
        <Badge
          variant="standard"
          sx={{
            fontSize: "sm",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          {featureToggles.mode ?? "review mode"}
        </Badge>
      )}
      {cloudMode && prID && (
        <Badge
          variant="standard"
          sx={{
            fontSize: "sm",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <HStack>
            <Box>cloud mode</Box>
            <Box
              sx={{
                borderLeftWidth: "1px",
                borderLeftColor: "rgba(255,255,255,0.8)",
                borderLeftStyle: "solid",
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
                <Text
                  sx={{ color: "rgba(255,255,255,0.8)", display: "inline" }}
                >{`#${String(prID)}`}</Text>
              </Link>
            </Box>
          </HStack>
        </Badge>
      )}
      {isDemoSite && prURL && demoPrId && (
        <Badge
          variant="standard"
          sx={{
            fontSize: "sm",
            color: "rgba(255,255,255,0.8)",
            textTransform: "uppercase",
            borderColor: "rgba(255,255,255,0.8)",
          }}
        >
          <HStack>
            <Box>demo mode</Box>
            <Box
              sx={{
                borderLeftWidth: "1px",
                borderLeftColor: "rgba(255,255,255,0.8)",
                borderLeftStyle: "solid",
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
                <Text
                  sx={{ color: "rgba(255,255,255,0.8)", display: "inline" }}
                >{`#${demoPrId}`}</Text>
              </Link>
            </Box>
          </HStack>
        </Badge>
      )}
      <Spacer />

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
            href="https://docs.datarecce.io"
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
                  color: "white",
                  fontSize: "sm",
                  fontWeight: "semibold",
                  bgcolor: "brand.700",
                  borderRadius: "md",
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
    </Flex>
  );
}
