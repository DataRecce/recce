"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useRef, useState } from "react";
import { PiUserPlus, PiX } from "react-icons/pi";
import { useRecceInstanceContext } from "../../contexts";
import { useApiConfig } from "../../hooks/useApiConfig";
import { connectToCloud } from "../../lib/api/connectToCloud";
import { fetchUser } from "../../lib/api/user";

type PopoverState = "signup" | "waiting" | "reload";

export function CloudShareButton() {
  const { authed } = useRecceInstanceContext();
  const { apiClient } = useApiConfig();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [popoverState, setPopoverState] = useState<PopoverState>("signup");
  const waitingRef = useRef(false);

  const checkAuth = useCallback(async () => {
    if (!waitingRef.current) return;
    try {
      await fetchUser(apiClient);
      waitingRef.current = false;
      setPopoverState("reload");
    } catch {
      // Not authenticated yet
    }
  }, [apiClient]);

  // Check auth when user switches back to this tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkAuth();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [checkAuth]);

  // PR2 will handle the authed path (upload confirmation dialog)
  if (authed) {
    return null;
  }

  const handleShareClick = (event: React.MouseEvent<HTMLElement>) => {
    setPopoverState("signup");
    waitingRef.current = false;
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    waitingRef.current = false;
  };

  const handleSignup = async () => {
    try {
      const { connection_url } = await connectToCloud(apiClient);
      window.open(connection_url, "_blank");
      waitingRef.current = true;
      setPopoverState("waiting");
    } catch {
      // Stay on signup state if connection fails
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        size="small"
        startIcon={<PiUserPlus />}
        onClick={handleShareClick}
        sx={{
          borderRadius: "100px",
          textTransform: "none",
          fontWeight: 600,
          px: 2,
          py: 0.5,
          mr: 1,
          whiteSpace: "nowrap",
        }}
      >
        Share
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "12px",
              p: 3,
              maxWidth: 360,
              mt: 1,
            },
          },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ position: "absolute", top: -12, right: -12 }}
            aria-label="Close"
          >
            <PiX />
          </IconButton>

          {popoverState === "signup" && (
            <>
              <Typography sx={{ mb: 3, pr: 2 }}>
                Sign up to Recce Cloud so your team members can see and query
                your instance directly
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSignup}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
                  px: 4,
                  py: 1,
                }}
              >
                Sign up
              </Button>
            </>
          )}

          {popoverState === "waiting" && (
            <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
              <CircularProgress size={40} />
              <Typography sx={{ fontWeight: 500, fontSize: "1.1rem" }}>
                Waiting for signup...
              </Typography>
              <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
                Complete signup in the browser tab.
              </Typography>
              <Button
                fullWidth
                variant="text"
                color="primary"
                size="small"
                onClick={handleSignup}
                sx={{ textTransform: "none" }}
              >
                Retry
              </Button>
            </Stack>
          )}

          {popoverState === "reload" && (
            <Stack spacing={2} alignItems="center" sx={{ py: 1 }}>
              <Box
                component="img"
                sx={{ height: "5rem", objectFit: "contain" }}
                src="/imgs/reload-image.svg"
                alt="Reload"
              />
              <Typography sx={{ fontWeight: 500, fontSize: "1.1rem" }}>
                Reload to Finish
              </Typography>
              <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
                Signup complete! Reload to connect to Recce Cloud.
              </Typography>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={() => window.location.reload()}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: 600,
                }}
              >
                Reload
              </Button>
            </Stack>
          )}
        </Box>
      </Popover>
    </>
  );
}
