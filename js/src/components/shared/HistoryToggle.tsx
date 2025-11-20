"use client";

import { Box, Button } from "@chakra-ui/react";
import React, { ReactNode } from "react";
import { VscHistory } from "react-icons/vsc";
import { trackHistoryAction } from "@/lib/api/track";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";

export default function HistoryToggle(): ReactNode {
  const { isHistoryOpen, showHistory } = useRecceActionContext();

  if (isHistoryOpen) {
    return;
  }

  return (
    <Box>
      <Box fontSize="8pt">History</Box>

      <Button
        size="2xs"
        variant="outline"
        onClick={() => {
          trackHistoryAction({ name: isHistoryOpen ? "hide" : "show" });
          showHistory();
        }}
      >
        <VscHistory /> Show
      </Button>
    </Box>
  );
}
