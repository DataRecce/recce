"use client";

import LineageView from "@/components/lineage/LineageView";
import { Tabs, TabList, Tab, ChakraProvider, Box } from "@chakra-ui/react";
import { useLayoutEffect } from "react";
import * as amplitude from "@amplitude/analytics-browser";
import { QueryClientProvider } from "@tanstack/react-query";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useVersionNumber } from "@/lib/api/version";
import { CheckPage } from "@/components/check/CheckPage";
import { QueryPage } from "@/components/query/QueryPage";
import { Redirect, Route, Router, Switch, useLocation } from "wouter";

import _ from "lodash";
import { useHashLocation } from "@/lib/hooks/useHashLocation";

function getCookie(key: string) {
  var b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
  return b ? b.pop() : "";
}

function NavBar() {
  const [location, setLocation] = useLocation();
  const version = useVersionNumber();

  const tabs = [
    ["Lineage", "/lineage"],
    ["Query", "/query"],
    ["Checklist", "/checks"],
  ];

  const tabIndex = _.findIndex(tabs, ([, href]) => location.startsWith(href));

  return (
    <Tabs index={tabIndex}>
      <TabList>
        {tabs.map(([name, href]) => {
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

        <Box position="absolute" right="0" top="0" p="2" color="gray.500">
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

  const pageHeight = "calc(100vh - 42px)";

  return (
    <ChakraProvider>
      <QueryClientProvider client={reactQueryClient}>
        <RecceContextProvider>
          <Router hook={useHashLocation}>
            <NavBar />

            <Box p={0} h={pageHeight} maxH={pageHeight} overflow="auto">
              <Switch>
                <Route path="/lineage">
                  <LineageView />
                </Route>
                <Route path="/query">
                  <QueryPage />
                </Route>
                <Route path="/checks/:slug*">
                  <CheckPage />
                </Route>
                <Route path="/ssr">
                  <>Loading</>
                </Route>
                <Route>
                  <Redirect to="/lineage" />
                </Route>
              </Switch>
            </Box>
          </Router>
        </RecceContextProvider>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
