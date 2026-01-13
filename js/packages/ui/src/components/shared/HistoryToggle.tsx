"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { ReactNode } from "react";
import { VscHistory } from "react-icons/vsc";
import { useRecceActionContext } from "../../contexts";
import { trackHistoryAction } from "../../lib/api/track";

export function HistoryToggle(): ReactNode {
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
