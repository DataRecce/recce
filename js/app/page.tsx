"use client";

import {
  Image,
  Tabs,
  TabList,
  Tab,
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
  useToast,
} from "@chakra-ui/react";
import React, { ReactNode, useEffect, useLayoutEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import _ from "lodash";
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
import { RunList } from "@/components/run/RunList";
import { trackInit } from "@/lib/api/track";
import { Filename } from "@/components/app/Filename";
import { StateSynchronizer } from "@/components/app/StateSynchronizer";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { TopLevelShare } from "@/components/app/StateSharing";
import { useCountdownToast } from "@/lib/hooks/useCountdownToast";
import AuthModal from "@/components/AuthModal/AuthModal";

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
    <Link height="20px" color="white" href={href} isExternal {...prob}>
      <Icon color="white" boxSize="20px" as={icon} />
    </Link>
  );
}

function RecceVersionBadge() {
  const { version, latestVersion } = useVersionNumber();
  const updateAvailableToaster = useToast();
  const updateAvailableToastId = "recce-update-available";
  const versionFormatRegex = new RegExp("^\\d+\\.\\d+\\.\\d+$");
  if (!versionFormatRegex.test(version)) {
    // If the version is not in the format of x.y.z, don't apply
    return (
      <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
        {version}
      </Badge>
    );
  }

  if (version !== latestVersion && !updateAvailableToaster.isActive(updateAvailableToastId)) {
    updateAvailableToaster({
      id: updateAvailableToastId,
      title: "Update available",
      position: "top-right",
      description: (
        <span>
          A new version of Recce (v{latestVersion}) is available.
          <br />
          Please run <Code>pip install --upgrade recce</Code> to update Recce.
          <br />
          <Link
            color="rgb(255, 215, 0)"
            fontWeight={"bold"}
            href={`https://github.com/DataRecce/recce/releases/tag/v${latestVersion}`}
            isExternal
            _hover={{ textDecoration: "underline" }}
            target="_blank">
            Click here to view the detail of latest release
          </Link>
        </span>
      ),
      containerStyle: {
        background: "rgba(20, 20, 20, 0.6)", // Semi-transparent black
        color: "white", // Ensure text is visible
        backdropFilter: "blur(10px)", // Frosted glass effect
        borderRadius: "8px",
      },
      variant: "unstyled",
      isClosable: true,
    });
  }

  // Link to the release page on GitHub if the version is in the format of x.y.z
  return (
    <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
      <Link
        href={`https://github.com/DataRecce/recce/releases/tag/v${version}`}
        isExternal
        _hover={{ textDecoration: "none" }}>
        {version}
      </Link>
    </Badge>
  );
}

function TopBar() {
  const { reviewMode, isDemoSite, envInfo, cloudMode } = useLineageGraphContext();
  const { readOnly, lifetimeExpiredAt } = useRecceInstanceContext();
  const { url: prURL, id: prID } = envInfo?.pullRequest ?? {};
  const demoPrId = prURL ? prURL.split("/").pop() : null;

  useCountdownToast(lifetimeExpiredAt);

  return (
    <Flex gap="10px" minHeight="40px" alignItems="center" bg="rgb(255, 110, 66)">
      <Image
        boxSize="20px"
        ml="18px"
        src="/logo/recce-logo-white.png"
        alt="recce-logo-white"></Image>
      <Heading as="h1" fontFamily={`"Montserrat", sans-serif`} fontSize="lg" color="white">
        RECCE
      </Heading>
      <RecceVersionBadge />
      {(readOnly || reviewMode) && (
        <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
          {readOnly ? "read only" : "review mode"}
        </Badge>
      )}
      {cloudMode && prID && (
        <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
          <HStack>
            <Box>cloud mode</Box>
            <Box borderLeft="1px" borderLeftColor="whiteAlpha.500" paddingLeft="8px">
              <Link href={prURL} _hover={{ textDecoration: "none" }} isExternal>
                <Icon as={VscGitPullRequest} boxSize="3" fontWeight="extrabold" strokeWidth="1" />
                {` #${String(prID)}`}
              </Link>
            </Box>
          </HStack>
        </Badge>
      )}
      {isDemoSite && prURL && demoPrId && (
        <>
          <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
            <HStack>
              <Box>demo mode</Box>
              <Box borderLeft="1px" borderLeftColor="whiteAlpha.500" paddingLeft="8px">
                <Link href={prURL} _hover={{ textDecoration: "none" }} isExternal>
                  <Icon as={VscGitPullRequest} boxSize="3" fontWeight="extrabold" strokeWidth="1" />
                  {` #${demoPrId}`}
                </Link>
              </Box>
            </HStack>
          </Badge>
        </>
      )}
      <Spacer />
      <LinkIcon icon={FaGithub} href="https://github.com/DataRecce/recce" />
      <LinkIcon icon={FaSlack} href="https://getdbt.slack.com/archives/C05C28V7CPP" />
      <LinkIcon mr="18px" icon={FaQuestionCircle} href="https://docs.datarecce.io" />
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
  const { readOnly } = useRecceInstanceContext();
  const [location, setLocation] = useLocation();
  const { data: flag, isLoading: isFlagLoading } = useRecceServerFlag();

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

  const tabIndex = _.findIndex(tabs, ({ href }) => location.startsWith(href));

  return (
    <Tabs index={tabIndex}>
      <TabList>
        <Box flex="1" display="flex">
          {tabs.map(({ name, href, badge, disable }) => {
            return (
              <Tab
                key={name}
                onClick={() => {
                  setLocation(href);
                }}
                isDisabled={!!isLoading || isFlagLoading || disable}
                hidden={disable}>
                {name}
                {badge}
              </Tab>
            );
          })}
        </Box>
        <Flex flex="3" justifyContent="right" alignItems="center">
          {!isLoading && !isDemoSite && <Filename />}
        </Flex>
        <Flex flex="3" justifyContent="left" alignItems="center">
          {!isLoading && !isDemoSite && !flag?.single_env_onboarding && !readOnly && (
            <TopLevelShare />
          )}
        </Flex>
        {!isLoading && (
          <Flex flex="3" justifyContent="right" alignItems="center" mr="8px">
            <EnvInfo />
            {cloudMode && <StateSynchronizer />}
            <StateExporter />
          </Flex>
        )}
      </TabList>
    </Tabs>
  );
}

function Main() {
  const { isRunResultOpen, isHistoryOpen, closeRunResult } = useRecceActionContext();
  const { data: flag } = useRecceServerFlag();
  const [location] = useLocation();
  const _isRunResultOpen = isRunResultOpen;
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
              <Route path="/checks/:slug*">
                <CheckPage />
              </Route>
              <Route path="/runs/:runId">
                {({ runId }) => {
                  return <RunPage runId={runId} />;
                }}
              </Route>
              <Route path="/ssr">
                <Progress size="xs" isIndeterminate />
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
  const { isDemoSite, isLoading } = useLineageGraphContext();

  useEffect(() => {
    trackInit();
  }, []);

  return (
    <MainContainer>
      <TopBar />
      <NavBar />
      <Main />
      {!isLoading && !isDemoSite && <AuthModal />}
    </MainContainer>
  );
}
