import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Link,
  LinkProps,
  Spacer,
  Text,
} from "@chakra-ui/react";
import RecceVersionBadge from "app/(mainComponents)/RecceVersionBadge";
import React, { useState } from "react";
import { IconType } from "react-icons";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { VscGitPullRequest } from "react-icons/vsc";
import AuthModal from "@/components/AuthModal/AuthModal";
import AvatarDropdown from "@/components/app/AvatarDropdown";
import { IdleTimeoutBadge } from "@/components/timeout/IdleTimeoutBadge";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

interface LinkIconProps extends LinkProps {
  icon: IconType;
  href: string;
}

function LinkIcon({ icon, href, ...prob }: LinkIconProps) {
  return (
    <Link height="20px" color="white" href={href} target="_blank" {...prob}>
      <Icon color="white" boxSize="20px" as={icon} />
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
      gap="10px"
      minHeight="40px"
      alignItems="center"
      bg="rgb(255, 110, 66)"
    >
      <Link
        href={brandLink}
        target="_blank"
        _hover={{ textDecoration: "none" }}
      >
        <Flex gap="10px" alignItems="center">
          <Image
            boxSize="20px"
            ml="18px"
            src="/logo/recce-logo-white.png"
            alt="recce-logo-white"
          ></Image>
          <Heading
            as="h1"
            fontFamily={`"Montserrat", sans-serif`}
            fontSize="lg"
            color="white"
          >
            RECCE
          </Heading>
        </Flex>
      </Link>
      <RecceVersionBadge />
      {(featureToggles.mode ?? reviewMode) && (
        <Badge
          fontSize="sm"
          color="white/80"
          variant="outline"
          textTransform="uppercase"
        >
          {featureToggles.mode ?? "review mode"}
        </Badge>
      )}
      {cloudMode && prID && (
        <Badge
          fontSize="sm"
          color="white/80"
          variant="outline"
          textTransform="uppercase"
        >
          <HStack>
            <Box>cloud mode</Box>
            <Box
              borderLeftWidth="1px"
              borderLeftColor="white/80"
              paddingLeft="8px"
            >
              <Link
                href={prURL}
                _hover={{ textDecoration: "none" }}
                target="_blank"
              >
                <Icon
                  color="white/80"
                  as={VscGitPullRequest}
                  boxSize="3"
                  marginRight={0.5}
                  fontWeight="extrabold"
                  strokeWidth="1"
                />
                <Text color="white/80">{`#${String(prID)}`}</Text>
              </Link>
            </Box>
          </HStack>
        </Badge>
      )}
      {isDemoSite && prURL && demoPrId && (
        <Badge
          fontSize="sm"
          color="white/80"
          variant="outline"
          textTransform="uppercase"
        >
          <HStack>
            <Box>demo mode</Box>
            <Box
              borderLeftWidth="1px"
              borderLeftColor="white/80"
              paddingLeft="8px"
            >
              <Link
                href={prURL}
                _hover={{ textDecoration: "none" }}
                target="_blank"
              >
                <Icon
                  color="white/80"
                  as={VscGitPullRequest}
                  boxSize="3"
                  marginRight={0.5}
                  fontWeight="extrabold"
                  strokeWidth="1"
                />
                <Text color="white/80">{`#${demoPrId}`}</Text>
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
            mr={2}
            icon={FaQuestionCircle}
            href="https://docs.datarecce.io"
          />
        </>
      )}
      {!isDemoSite && featureToggles.mode !== "read only" && (
        <>
          <IdleTimeoutBadge />
          {authed || cloudMode ? (
            <Box mr={2}>
              <AvatarDropdown />
            </Box>
          ) : (
            <>
              <Box
                as="button"
                color="white"
                fontSize="sm"
                fontWeight="semibold"
                bg="brand.700"
                borderRadius="md"
                px={3}
                py={1}
                mr={2}
                cursor="pointer"
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
