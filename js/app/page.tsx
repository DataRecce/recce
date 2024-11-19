"use client";

import {
  Image,
  Tabs,
  TabList,
  Tab,
  ChakraProvider,
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
  extendTheme,
} from "@chakra-ui/react";
import React from "react";
import { ReactNode, useLayoutEffect } from "react";
import * as amplitude from "@amplitude/analytics-browser";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useVersionNumber } from "@/lib/api/version";
import { CheckPage } from "@/components/check/CheckPage";
import { QueryPage } from "@/components/query/QueryPage";
import { Redirect, Route, Router, Switch, useLocation, useRoute } from "wouter";

import _ from "lodash";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { ThemeProvider, Tooltip, createTheme } from "@mui/material";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { InfoIcon } from "@chakra-ui/icons";
import { RunPage } from "@/components/run/RunPage";
import { ErrorBoundary } from "@/components/errorboundary/ErrorBoundary";
import { StateExporter } from "@/components/check/StateExporter";
import { StateImporter } from "@/components/check/StateImporter";
import { FaGithub, FaQuestionCircle, FaSlack } from "react-icons/fa";
import { IconType } from "react-icons";
import "@fontsource/montserrat/800.css";
import { EnvInfo } from "@/components/env/EnvInfo";
import { StateSynchronizer } from "@/components/check/StateSynchronizer";
import { Check, listChecks } from "@/lib/api/checks";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { LineagePage } from "@/components/lineage/LineagePage";
import OnboardingGuide from "@/components/onboarding-guide/OnboardingGuide";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { HSplit, VSplit } from "@/components/split/Split";
import { RunResultPane } from "@/components/run/RunResultPane";
import { VscGitPullRequest } from "react-icons/vsc";
import { RunList } from "@/components/run/RunList";
import { checkboxTheme } from "@theme/components/Checkbox";
import { tooltipTheme } from "@theme/components/Tooltip";

function getCookie(key: string) {
  var b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
  return b ? b.pop() : "";
}

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
    <Link height="20px" color="white" href={href} isExternal {...prob}>
      <Icon color="white" boxSize="20px" as={icon} />
    </Link>
  );
}

function TopBar() {
  const { reviewMode, isDemoSite, envInfo, cloudMode, isLoading } =
    useLineageGraphContext();
  const version = useVersionNumber();
  const { url: prURL, id: prID } = envInfo?.pullRequest || {};
  const demoPrId = prURL ? prURL.split("/").pop() : null;

  return (
    <Flex
      gap="10px"
      minHeight="40px"
      alignItems="center"
      bg="rgb(255, 110, 66)"
    >
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
      <Badge
        fontSize="sm"
        color="white"
        colorScheme="whiteAlpha"
        variant="outline"
      >
        {version}
      </Badge>
      {reviewMode && (
        <Badge
          fontSize="sm"
          color="white"
          colorScheme="whiteAlpha"
          variant="outline"
        >
          review mode
        </Badge>
      )}
      {cloudMode && (
        <Badge
          fontSize="sm"
          color="white"
          colorScheme="whiteAlpha"
          variant="outline"
        >
          <HStack>
            <Box>cloud mode</Box>
            <Box
              borderLeft="1px"
              borderLeftColor="whiteAlpha.500"
              paddingLeft="8px"
            >
              <Link href={prURL} _hover={{ textDecoration: "none" }} isExternal>
                <Icon
                  as={VscGitPullRequest}
                  boxSize="3"
                  fontWeight="extrabold"
                  strokeWidth="1"
                />
                {` #${prID}`}
              </Link>
            </Box>
          </HStack>
        </Badge>
      )}
      {isDemoSite && prURL && (
        <>
          <Badge
            fontSize="sm"
            color="white"
            colorScheme="whiteAlpha"
            variant="outline"
          >
            <HStack>
              <Box>demo mode</Box>
              <Box
                borderLeft="1px"
                borderLeftColor="whiteAlpha.500"
                paddingLeft="8px"
              >
                <Link
                  href={prURL}
                  _hover={{ textDecoration: "none" }}
                  isExternal
                >
                  <Icon
                    as={VscGitPullRequest}
                    boxSize="3"
                    fontWeight="extrabold"
                    strokeWidth="1"
                  />
                  {` #${demoPrId}`}
                </Link>
              </Box>
            </HStack>
          </Badge>
        </>
      )}
      <Spacer />
      <LinkIcon icon={FaGithub} href="https://github.com/DataRecce/recce" />
      <LinkIcon
        icon={FaSlack}
        href="https://getdbt.slack.com/archives/C05C28V7CPP"
      />
      <LinkIcon
        mr="18px"
        icon={FaQuestionCircle}
        href="https://datarecce.io/docs"
      />
    </Flex>
  );
}
interface TabProps {
  name: string;
  href: string;
  badge?: ReactNode;
}

function TabBadge<T, R extends number>({
  queryKey,
  fetchCallback,
  selectCallback,
}: {
  queryKey: string[];
  fetchCallback: () => Promise<T>;
  selectCallback?: (data: T) => R;
}) {
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
  const { isDemoSite, reviewMode, cloudMode, isLoading } =
    useLineageGraphContext();
  const [location, setLocation] = useLocation();

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
    { name: "Checklist", href: "/checks", badge: checklistBadge },
  ];

  const tabIndex = _.findIndex(tabs, ({ href }) => location.startsWith(href));

  return (
    <Tabs index={tabIndex}>
      <TabList>
        {tabs.map(({ name, href, badge }) => {
          return (
            <Tab
              key={name}
              onClick={() => {
                setLocation(href);
              }}
            >
              {name}
              {badge}
            </Tab>
          );
        })}
        <Spacer />
        {!isLoading && (
          <>
            {cloudMode && <StateSynchronizer />}
            {!isDemoSite && !cloudMode && <StateImporter />}
            {!isDemoSite && cloudMode && reviewMode && (
              <StateImporter checksOnly />
            )}
            <StateExporter />
          </>
        )}
        <EnvInfo />
      </TabList>
    </Tabs>
  );
}

function Main() {
  const { isRunResultOpen, isHistoryOpen, closeRunResult } =
    useRecceActionContext();
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
          <RunResultPane onClose={closeRunResult} />
        ) : (
          <Box></Box>
        )}
      </VSplit>
    </HSplit>
  );
}

const chakraTheme = extendTheme({
  components: {
    Checkbox: checkboxTheme,
    Tooltip: tooltipTheme,
  },
});

export default function Home() {
  useLayoutEffect(() => {
    const userId = getCookie("recce_user_id");
    if (userId && process.env.AMPLITUDE_API_KEY) {
      try {
        // Initialize Amplitude
        amplitude.init(process.env.AMPLITUDE_API_KEY, userId, {
          defaultTracking: true,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const muiDefaultTheme = createTheme({
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            zIndex: 1500,
          },
        },
      },
    },
  });

  return (
    <ThemeProvider theme={muiDefaultTheme}>
      <ChakraProvider theme={chakraTheme}>
        <QueryClientProvider client={reactQueryClient}>
          <Router hook={useHashLocation}>
            <RecceContextProvider>
              <Flex direction="column" height="100vh">
                <TopBar />
                <NavBar />
                <OnboardingGuide />
                <Main />
              </Flex>
            </RecceContextProvider>
          </Router>
        </QueryClientProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
