"use client";

import QueryView from "@/components/query/QueryView";
import LineageView from "@/components/lineage/LineageView";
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  ChakraProvider, Box
} from "@chakra-ui/react";
import { useLayoutEffect } from "react";
import * as amplitude from "@amplitude/analytics-browser";
import { QueryClientProvider } from "@tanstack/react-query";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useVersionNumber } from "@/lib/api/useVersion";

function getCookie(key: string) {
  var b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
  return b ? b.pop() : "";
}


export default function Home() {
  const version = useVersionNumber();
  useLayoutEffect(() => {
    const userId = getCookie("recce_user_id");
    if (userId && process.env.AMPLITUDE_API_KEY) {
      try {
        // Initialize Amplitude
        amplitude.init(process.env.AMPLITUDE_API_KEY, userId, {
          defaultTracking: true
        });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  return (
    <ChakraProvider>
      <QueryClientProvider client={reactQueryClient}>
        <Tabs>
          <TabList>
            <Tab>Lineage</Tab>
            <Tab>Query</Tab>
            <Box position="absolute" right="0" top="0" p="2" color="gray.500">
              {version}
            </Box>
          </TabList>

          <TabPanels>
            <TabPanel p={0}>
              <LineageView />
            </TabPanel>
            <TabPanel p={0}>
              <QueryView />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
