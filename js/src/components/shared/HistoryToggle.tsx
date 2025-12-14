"use client";

import React, { ReactNode } from "react";
import { VscHistory } from "react-icons/vsc";
import { Box, Button } from "@/components/ui/mui";
import { trackHistoryAction } from "@/lib/api/track";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";

export default function HistoryToggle(): ReactNode {
  const { isHistoryOpen, showHistory } = useRecceActionContext();

  if (isHistoryOpen) {
    return;
  }

  return (
    <Box>
      <Box sx={{ fontSize: "8pt" }}>History</Box>

      <Button
        size="xs"
        variant="outlined"
        startIcon={<VscHistory />}
        onClick={() => {
          trackHistoryAction({ name: isHistoryOpen ? "hide" : "show" });
          showHistory();
        }}
      >
        Show
      </Button>
    </Box>
  );
}
