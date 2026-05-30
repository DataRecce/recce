"use client";

import Button from "@mui/material/Button";
import MuiPopover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { LOCAL_STORAGE_KEYS } from "../../api/storageKeys";

/**
 * One-shot popover that introduces the snapshot-base staleness feature.
 * Shown once per user (localStorage flag). Anchors to the banner element.
 *
 * @param anchorEl - DOM element to anchor the popover to (typically the banner).
 */
export interface FirstTimePopoverProps {
  anchorEl: HTMLElement | null;
}

export function FirstTimePopover({ anchorEl }: FirstTimePopoverProps) {
  const [open, setOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const seen = localStorage.getItem(
        LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen,
      );
      if (!seen) {
        setOpen(true);
      }
    } catch {
      // localStorage not available (e.g. SSR) — stay closed
    }
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.snapshotBaseIntroSeen, "1");
    } catch {
      // localStorage not available — ignore
    }
    setOpen(false);
  }, []);

  return (
    <MuiPopover
      open={open && anchorEl !== null}
      anchorEl={anchorEl}
      onClose={handleDismiss}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      disableAutoFocus
      slotProps={{
        paper: {
          sx: {
            bgcolor: "grey.800",
            color: "white",
            p: 2,
            maxWidth: 360,
          },
        },
      }}
    >
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        New: Recce now snapshots your base data when each PR is created.
        We&apos;ll let you know when production has changed since then so your
        comparisons stay accurate.
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={handleDismiss}
        sx={{ bgcolor: "grey.600", "&:hover": { bgcolor: "grey.500" } }}
      >
        Got it
      </Button>
    </MuiPopover>
  );
}
