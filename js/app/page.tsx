"use client";

import {
  Badge,
  Box,
  Code,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Link,
  LinkProps,
  Progress,
  Spacer,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { IconType } from "react-icons";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { Redirect, Route, Switch, useLocation, useRoute } from "wouter";
import { StateExporter } from "@/components/app/StateExporter";
import { CheckPage } from "@/components/check/CheckPage";
import { ErrorBoundary } from "@/components/errorboundary/ErrorBoundary";
import { QueryPage } from "@/components/query/QueryPage";
import { RunPage } from "@/components/run/RunPage";
import { useVersionNumber } from "@/lib/api/version";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import "@fontsource/montserrat/800.css";
import { VscGitPullRequest } from "react-icons/vsc";
import AuthModal from "@/components/AuthModal/AuthModal";
import AvatarDropdown from "@/components/app/AvatarDropdown";
import { EnvInfo } from "@/components/app/EnvInfo";
import { Filename } from "@/components/app/Filename";
import { TopLevelShare } from "@/components/app/StateSharing";
import { StateSynchronizer } from "@/components/app/StateSynchronizer";
import { LineagePage } from "@/components/lineage/LineagePage";
import { RunList } from "@/components/run/RunList";
import { RunResultPane } from "@/components/run/RunResultPane";
import { HSplit, VSplit } from "@/components/split/Split";
import { toaster } from "@/components/ui/toaster";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, listChecks } from "@/lib/api/checks";
import { trackInit, trackNavigation } from "@/lib/api/track";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useCountdownToast } from "@/lib/hooks/useCountdownToast";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";

const RouteAlwaysMount = ({
  children,
  path,
}: {
  children: ReactNode;
  path: string;
}) => {
  const [match] = useRoute(path);
  return (
    <Box display={match ? "block" : "none"} height="100%">
      {children}
    </Box>
  );
};

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

function RecceVersionBadge() {
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

function TopBar() {
  const { reviewMode, isDemoSite, envInfo, cloudMode } =
    useLineageGraphContext();
  const { featureToggles, lifetimeExpiredAt, authed } =
    useRecceInstanceContext();
  const { url: prURL, id: prID } = envInfo?.pullRequest ?? {};
  const demoPrId = prURL ? prURL.split("/").pop() : null;
  const brandLink =
    cloudMode || authed
      ? "https://cloud.datarecce.io/"
      : "https://reccehq.com/";
  const [showModal, setShowModal] = useState(false);

  useCountdownToast(lifetimeExpiredAt);

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

interface TabProps {
  name: string;
  href: string;
  badge?: ReactNode;
  disable?: boolean;
}

interface TabBadgeProps<T> {
  queryKey: string[];
  fetchCallback: () => Promise<T>;
  selectCallback?: (data: T) => number;
}

function TabBadge<T>({
  queryKey,
  fetchCallback,
  selectCallback,
}: TabBadgeProps<T>): ReactNode {
  const {
    data: count,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKey,
    queryFn: fetchCallback,
    select: selectCallback,
  });

  if (isLoading || error || count === 0) {
    return <></>;
  }

  return (
    <Box
      ml="2px"
      maxH={"20px"}
      height="80%"
      aspectRatio={1}
      borderRadius="full"
      bg="tomato"
      alignContent={"center"}
      color="white"
      fontSize="xs"
    >
      {count}
    </Box>
  );
}

function NavBar() {
  const { isDemoSite, cloudMode, isLoading } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const [location, setLocation] = useLocation();
  const [valueLocation, setValueLocation] = useState("/lineage");
  const { data: flag, isLoading: isFlagLoading } = useRecceServerFlag();

  const checklistBadge = (
    <TabBadge<Check[]>
      queryKey={cacheKeys.checks()}
      fetchCallback={listChecks}
      selectCallback={(checks: Check[]) => {
        return checks.filter((check) => !check.is_checked).length;
      }}
    />
  );

  const tabs: TabProps[] = [
    { name: "Lineage", href: "/lineage" },
    { name: "Query", href: "/query" },
    {
      name: "Checklist",
      href: "/checks",
      badge: checklistBadge,
      disable: flag?.single_env_onboarding === true,
    },
  ];

  useEffect(() => {
    setValueLocation(`/${location.split("/")[1]}`);
    // Only run on page load
  }, [location]);

  return (
    <Tabs.Root
      colorPalette="iochmara"
      defaultValue="/lineage"
      value={valueLocation}
      onValueChange={(e) => {
        setValueLocation(e.value);
      }}
    >
      <Tabs.List
        display="grid"
        gridTemplateColumns="1fr auto 1fr"
        alignItems="center"
      >
        {/* Left section: Tabs */}
        <Box display="flex">
          {tabs.map(({ name, href, badge, disable }) => {
            return (
              <Tabs.Trigger
                value={href}
                key={href}
                onClick={() => {
                  trackNavigation({ from: location, to: href });
                  setLocation(href);
                }}
                disabled={!!isLoading || isFlagLoading || disable}
                hidden={disable}
              >
                {name}
                {badge}
              </Tabs.Trigger>
            );
          })}
        </Box>

        {/* Center section: Filename and TopLevelShare */}
        <Flex alignItems="center" gap="12px" justifyContent="center">
          {!isLoading && !isDemoSite && <Filename />}
          {!isLoading &&
            !isDemoSite &&
            !flag?.single_env_onboarding &&
            !featureToggles.disableShare && <TopLevelShare />}
        </Flex>

        {/* Right section: EnvInfo, StateSynchronizer, StateExporter */}
        {!isLoading && (
          <Flex justifyContent="right" alignItems="center" mr="8px">
            <EnvInfo />
            {cloudMode && <StateSynchronizer />}
            <StateExporter />
          </Flex>
        )}
      </Tabs.List>
    </Tabs.Root>
  );
}

function Main() {
  const { isRunResultOpen, isHistoryOpen, closeRunResult } =
    useRecceActionContext();
  const { data: flag } = useRecceServerFlag();
  const [location] = useLocation();
  const _isRunResultOpen = isRunResultOpen && !location.startsWith("/checks");
  const _isHistoryOpen = isHistoryOpen && !location.startsWith("/checks");

  return (
    <HSplit
      sizes={[0, 100]}
      minSize={_isHistoryOpen ? 300 : 0}
      gutterSize={_isHistoryOpen ? 5 : 0}
      style={{ height: "100%" }}
    >
      <Box style={{ contain: "size" }}>{_isHistoryOpen && <RunList />}</Box>
      <VSplit
        sizes={_isRunResultOpen ? [50, 50] : [100, 0]}
        minSize={_isRunResultOpen ? 100 : 0}
        gutterSize={_isRunResultOpen ? 5 : 0}
        style={{
          flex: "1",
          contain: "size",
        }}
      >
        <Box p={0} style={{ contain: "content" }}>
          <ErrorBoundary>
            {/* Prevent the lineage page unmount and lose states */}
            <RouteAlwaysMount path="/lineage">
              <LineagePage />
            </RouteAlwaysMount>
            <Switch>
              <Route path="/query">
                <QueryPage />
              </Route>
              <Route path="/checks/:slug?">
                <CheckPage />
              </Route>
              <Route path="/runs/:runId">
                {({ runId }) => {
                  return <RunPage runId={runId} />;
                }}
              </Route>
              <Route path="/ssr">
                <Progress.Root size="xs" value={null} colorPalette="iochmara">
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Route>
              <Route>
                <Redirect to="/lineage" />
              </Route>
            </Switch>
          </ErrorBoundary>
        </Box>
        {_isRunResultOpen ? (
          <RunResultPane
            onClose={closeRunResult}
            isSingleEnvironment={!!flag?.single_env_onboarding}
          />
        ) : (
          <Box></Box>
        )}
      </VSplit>
    </HSplit>
  );
}

function MainContainer({ children }: { children: ReactNode }): ReactNode {
  return (
    <Flex direction="column" height="100vh" overflow="hidden">
      {children}
    </Flex>
  );
}

export default function Home() {
  const { isDemoSite, isLoading, isCodespace } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();

  useEffect(() => {
    trackInit();
  }, []);

  return (
    <MainContainer>
      <TopBar />
      <NavBar />
      <Main />
      {!isLoading &&
        !isDemoSite &&
        !isCodespace &&
        featureToggles.mode === null && <AuthModal />}
    </MainContainer>
  );
}
