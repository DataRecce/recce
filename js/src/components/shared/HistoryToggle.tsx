"use client";

import React, { ReactNode } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { Box, Button, Drawer, Portal } from "@chakra-ui/react";
import { trackHistoryAction } from "@/lib/api/track";
import { VscHistory } from "react-icons/vsc";
import { RunList } from "@/components/run/RunList";

export default function HistoryToggle(): ReactNode {
  const { isHistoryOpen, setHistoryOpen, showHistory, closeHistory } = useRecceActionContext();
  return (
    <Box>
      <Box fontSize="8pt">History</Box>

      <Drawer.Root
        placement="start"
        open={isHistoryOpen}
        onOpenChange={(e) => {
          setHistoryOpen(e.open);
        }}>
        <Drawer.Trigger asChild>
          <Button
            size="2xs"
            variant="outline"
            onClick={() => {
              if (isHistoryOpen) {
                trackHistoryAction({ name: "hide" });
                closeHistory();
              } else {
                trackHistoryAction({ name: "show" });
                showHistory();
              }
            }}>
            <VscHistory /> {isHistoryOpen ? "Hide" : "Show"}
          </Button>
        </Drawer.Trigger>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <RunList />
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    </Box>
  );
}
