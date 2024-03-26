"use client";

import LineageView from "@/components/lineage/LineageView";
import {
  Tabs,
  TabList,
  Tab,
  ChakraProvider,
  Box,
  Flex,
  Link,
  Text,
  Spacer,
} from "@chakra-ui/react";
import { ReactNode, useLayoutEffect } from "react";
import * as amplitude from "@amplitude/analytics-browser";
import { QueryClientProvider } from "@tanstack/react-query";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useVersionNumber } from "@/lib/api/version";
import { CheckPage } from "@/components/check/CheckPage";
import { QueryPage } from "@/components/query/QueryPage";
import { Redirect, Route, Router, Switch, useLocation, useRoute } from "wouter";

import _ from "lodash";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { ThemeProvider, createTheme } from "@mui/material";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { InfoIcon } from "@chakra-ui/icons";
import { RunPage } from "@/components/run/RunPage";
import { ErrorBoundary } from "@/components/errorboundary/ErrorBoundary";
import { StateExporter } from "@/components/check/StateExporter";
import { StateLoader } from "@/components/check/StateLoader";

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

function TopBar() {
  const { metadata } = useLineageGraphContext();
  const prURL = metadata?.pr_url;

  if (!prURL || prURL === null) {
    return <></>;
  }

  return (
    <Flex
      gap="5px"
      minHeight="35px"
      alignItems="center"
      justifyContent="center"
      bg="orange.300"
    >
      <InfoIcon color="orange.600" />
      <Text>
        Please check{" "}
        <Link
          textDecoration="underline"
          fontWeight="600"
          href={prURL}
          isExternal
        >
          this Pull Request
        </Link>{" "}
        comment for context about this Recce instance
      </Text>
    </Flex>
  );
}
interface TabProps {
  name: string;
  href: string;
}

function NavBar() {
  const { isDemoSite } = useLineageGraphContext();
  const [location, setLocation] = useLocation();
  const version = useVersionNumber();

  const tabs: TabProps[] = [
    { name: "Lineage", href: "/lineage" },
    { name: "Query", href: "/query" },
    { name: "Checks", href: "/checks" },
  ];

  const tabIndex = _.findIndex(tabs, ({ href }) => location.startsWith(href));

  return (
    <Tabs index={tabIndex}>
      <TabList>
        {tabs.map(({ name, href }) => {
          return (
            <Tab
              key={name}
              onClick={() => {
                setLocation(href);
              }}
            >
              {name}
            </Tab>
          );
        })}
        <Spacer />
        {!isDemoSite && (
          <>
            <StateExporter />
            <StateLoader />
          </>
        )}
        <Box p="8px" mr="10px" color="gray.500">
          {version}
        </Box>
      </TabList>
    </Tabs>
  );
}

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
      <ChakraProvider>
        <QueryClientProvider client={reactQueryClient}>
          <Router hook={useHashLocation}>
            <RecceContextProvider>
              <Flex direction="column" height="100vh">
                <TopBar />
                <NavBar />
                <ErrorBoundary>
                  <Box
                    p={0}
                    overflow="auto"
                    flex="1"
                    style={{ contain: "size" }}
                  >
                    {/* Prevent the lineage page unmount and lose states */}
                    <RouteAlwaysMount path="/lineage">
                      <LineageView />
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
                        <>Loading</>
                      </Route>
                      <Route>
                        <Redirect to="/lineage" />
                      </Route>
                    </Switch>
                  </Box>
                </ErrorBoundary>
              </Flex>
            </RecceContextProvider>
          </Router>
        </QueryClientProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
