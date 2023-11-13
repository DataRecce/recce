"use client";

import DiffView from "@/components/DiffView";
import LineageView from "@/components/LineageView";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "@chakra-ui/react";

export default function Home() {
  return (
    <Tabs>
      <TabList>
        <Tab>Lineage</Tab>
        <Tab>Query</Tab>
      </TabList>

      <TabPanels>
        <TabPanel>
          <LineageView />
        </TabPanel>
        <TabPanel>
          <DiffView />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
