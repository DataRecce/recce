"use client";

import { useRecceActionContext } from "@datarecce/ui/contexts";
import { trackHistoryAction } from "@datarecce/ui/lib/api/track";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import React, { ReactNode } from "react";
import { VscHistory } from "react-icons/vsc";

export default function HistoryToggle(): ReactNode {
  const { isHistoryOpen, showHistory } = useRecceActionContext();

  if (isHistoryOpen) {
    return;
  }

  return (
    <Box>
      <Box sx={{ fontSize: "8pt" }}>History</Box>

      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
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
