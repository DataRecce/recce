"use client";

import {
  Image,
  Tabs,
  Code,
  Box,
  Flex,
  Link,
  Spacer,
  Icon,
  LinkProps,
  Heading,
  Badge,
  Progress,
  HStack,
  Text,
} from "@chakra-ui/react";
import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVersionNumber } from "@/lib/api/version";
import { CheckPage } from "@/components/check/CheckPage";
import { QueryPage } from "@/components/query/QueryPage";
import { Redirect, Route, Switch, useLocation, useRoute } from "wouter";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { RunPage } from "@/components/run/RunPage";
import { ErrorBoundary } from "@/components/errorboundary/ErrorBoundary";
import { StateExporter } from "@/components/app/StateExporter";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { IconType } from "react-icons";
import "@fontsource/montserrat/800.css";
import { EnvInfo } from "@/components/app/EnvInfo";
import { Check, listChecks } from "@/lib/api/checks";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { LineagePage } from "@/components/lineage/LineagePage";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { HSplit, VSplit } from "@/components/split/Split";
import { RunResultPane } from "@/components/run/RunResultPane";
import { VscGitPullRequest } from "react-icons/vsc";
import { trackInit, trackTabChanged } from "@/lib/api/track";
import { Filename } from "@/components/app/Filename";
import { StateSynchronizer } from "@/components/app/StateSynchronizer";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { TopLevelShare } from "@/components/app/StateSharing";
import { useCountdownToast } from "@/lib/hooks/useCountdownToast";
import AuthModal from "@/components/AuthModal/AuthModal";
import { toaster } from "@/components/ui/toaster";
import { RunList } from "@/components/run/RunList";
import AvatarDropdown from "@/components/app/AvatarDropdown";

const RouteAlwaysMount = ({ children, path }: { children: ReactNode; path: string }) => {
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
  const versionFormatRegex = useMemo(() => new RegExp("^\\d+\\.\\d+\\.\\d+$"), []);

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
              Please run <Code>pip install --upgrade recce</Code> to update Recce.
              <br />
              <Link
                color="brand.700"
                fontWeight={"bold"}
                href={`https://github.com/DataRecce/recce/releases/tag/v${latestVersion}`}
                _hover={{ textDecoration: "underline" }}
                target="_blank">
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
      <Badge fontSize="sm" color="white/80" variant="outline" textTransform="uppercase">
        {version}
      </Badge>
    );
  }

  // Link to the release page on GitHub if the version is in the format of x.y.z
  return (
    <Badge fontSize="sm" color="white/80" variant="outline" textTransform="uppercase">
      <Link
        href={`https://github.com/DataRecce/recce/releases/tag/v${version}`}
        _hover={{ textDecoration: "none" }}>
        <Text color="white/80">{version}</Text>
      </Link>
    </Badge>
  );
}

function TopBar() {
  const { reviewMode, isDemoSite, envInfo, cloudMode } = useLineageGraphContext();
  const { featureToggles, lifetimeExpiredAt, authed } = useRecceInstanceContext();
  const { url: prURL, id: prID } = envInfo?.pullRequest ?? {};
  const demoPrId = prURL ? prURL.split("/").pop() : null;
  const brandLink = cloudMode || authed ? "https://cloud.datarecce.io/" : "https://reccehq.com/";
  const [showModal, setShowModal] = useState(false);

  useCountdownToast(lifetimeExpiredAt);

  return (
    <Flex gap="10px" minHeight="40px" alignItems="center" bg="rgb(255, 110, 66)">
      <Link href={brandLink} target="_blank" _hover={{ textDecoration: "none" }}>
        <Flex gap="10px" alignItems="center">
          <Image
            boxSize="20px"
            ml="18px"
            src="/logo/recce-logo-white.png"
            alt="recce-logo-white"></Image>
          <Heading as="h1" fontFamily={`"Montserrat", sans-serif`} fontSize="lg" color="white">
            RECCE
          </Heading>
        </Flex>
      </Link>
      <RecceVersionBadge />
      {(featureToggles.mode ?? reviewMode) && (
        <Badge fontSize="sm" color="white/80" variant="outline" textTransform="uppercase">
          {featureToggles.mode ?? "review mode"}
        </Badge>
      )}
      {cloudMode && prID && (
        <Badge fontSize="sm" color="white/80" variant="outline" textTransform="uppercase">
          <HStack>
            <Box>cloud mode</Box>
            <Box borderLeftWidth="1px" borderLeftColor="white/80" paddingLeft="8px">
              <Link href={prURL} _hover={{ textDecoration: "none" }} target="_blank">
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
        <Badge fontSize="sm" color="white/80" variant="outline" textTransform="uppercase">
          <HStack>
            <Box>demo mode</Box>
            <Box borderLeftWidth="1px" borderLeftColor="white/80" paddingLeft="8px">
              <Link href={prURL} _hover={{ textDecoration: "none" }} target="_blank">
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

      {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        (isDemoSite || featureToggles.mode === "read only") && (
          <>
            <LinkIcon icon={FaGithub} href="https://github.com/DataRecce/recce" />
            <LinkIcon icon={FaSlack} href="https://getdbt.slack.com/archives/C05C28V7CPP" />
            <LinkIcon mr={2} icon={FaQuestionCircle} href="https://docs.datarecce.io" />
          </>
        )
      }
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
                }}>
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

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function TabBadge<T, R extends number>({
  queryKey,
  fetchCallback,
  selectCallback,
}: {
  queryKey: string[];
  fetchCallback: () => Promise<T>;
  selectCallback?: (data: T) => R;
}): ReactNode {
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
      fontSize="xs">
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

  // Track tab timing for analytics
  const [tabStartTime, setTabStartTime] = useState<number>(Date.now());
  const [previousTab, setPreviousTab] = useState<string | null>(null);
  const isUserTabClickRef = React.useRef(false);

  const checklistBadge = (
    <TabBadge<Check[], number>
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
    const newTab = `/${location.split("/")[1]}`;
    // Only update if it's not a user click on a tab (avoid interrupting Chakra's state)
    if (!isUserTabClickRef.current) {
      setValueLocation(newTab);
    } else {
      // Reset the flag after handling
      isUserTabClickRef.current = false;
    }
  }, [location]);

  return (
    <Tabs.Root
      colorPalette="iochmara"
      defaultValue="/lineage"
      value={valueLocation}
      onValueChange={(e) => {
        const newTab = e.value;
        const now = Date.now();
        const timeOnTab = previousTab ? (now - tabStartTime) / 1000 : null;

        // Track tab change
        trackTabChanged({
          from_tab: previousTab,
          to_tab: newTab,
          time_on_previous_tab_seconds: timeOnTab,
        });

        // Update state
        setValueLocation(newTab);
        setPreviousTab(newTab);
        setTabStartTime(now);

        // Mark that a user tab click just happened so useEffect doesn't overwrite state
        isUserTabClickRef.current = true;
      }}>
      <Tabs.List>
        <Box flex="1" display="flex">
          {tabs.map(({ name, href, badge, disable }) => {
            return (
              <Tabs.Trigger
                value={href}
                key={href}
                onClick={() => {
                  setLocation(href);
                }}
                disabled={!!isLoading || isFlagLoading || disable}
                hidden={disable}>
                {name}
                {badge}
              </Tabs.Trigger>
            );
          })}
        </Box>
        <Flex flex="3" justifyContent="right" alignItems="center">
          {!isLoading && !isDemoSite && <Filename />}
        </Flex>
        <Flex flex="3" justifyContent="left" alignItems="center">
          {!isLoading &&
            !isDemoSite &&
            !flag?.single_env_onboarding &&
            !featureToggles.disableShare && <TopLevelShare />}
        </Flex>
        {!isLoading && (
          <Flex flex="3" justifyContent="right" alignItems="center" mr="8px">
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
  const { isRunResultOpen, isHistoryOpen, closeRunResult } = useRecceActionContext();
  const { data: flag } = useRecceServerFlag();
  const [location] = useLocation();
  const _isRunResultOpen = isRunResultOpen && !location.startsWith("/checks");
  const _isHistoryOpen = isHistoryOpen && !location.startsWith("/checks");

  return (
    <HSplit
      sizes={[0, 100]}
      minSize={_isHistoryOpen ? 300 : 0}
      gutterSize={_isHistoryOpen ? 5 : 0}
      style={{ height: "100%" }}>
      <Box style={{ contain: "size" }}>{_isHistoryOpen && <RunList />}</Box>
      <VSplit
        sizes={_isRunResultOpen ? [50, 50] : [100, 0]}
        minSize={_isRunResultOpen ? 100 : 0}
        gutterSize={_isRunResultOpen ? 5 : 0}
        style={{
          flex: "1",
          contain: "size",
        }}>
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
      {!isLoading && !isDemoSite && !isCodespace && featureToggles.mode === null && <AuthModal />}
    </MainContainer>
  );
}
