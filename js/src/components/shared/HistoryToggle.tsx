"use client";

import React, { ReactNode } from "react";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { Box, Button } from "@chakra-ui/react";
import { trackHistoryAction } from "@/lib/api/track";
import { VscHistory } from "react-icons/vsc";

export default function HistoryToggle(): ReactNode {
  const { isHistoryOpen, setHistoryOpen, showHistory, closeHistory } = useRecceActionContext();

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
          trackHistoryAction({ name: "show" });
          showHistory();
        }}>
        <VscHistory /> Show
      </Button>
    </Box>
  );
}
