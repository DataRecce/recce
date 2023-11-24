"use client";

import DiffView from "@/components/DiffView";
import LineageView from "@/components/lineagediff/LineageView";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "@chakra-ui/react";
import { useLayoutEffect } from "react";
import * as amplitude from '@amplitude/analytics-browser';



function getCookie(key: string) {
  var b = document.cookie.match("(^|;)\\s*" + key + "\\s*=\\s*([^;]+)");
  return b ? b.pop() : "";
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

  return (
    <Tabs>
      <TabList>
        <Tab>Lineage</Tab>
        <Tab>Query</Tab>
      </TabList>

      <TabPanels>
        <TabPanel p={0}>
          <LineageView />
        </TabPanel>
        <TabPanel p={0}>
          <DiffView />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
