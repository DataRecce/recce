"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Cookies from "js-cookie";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { LuExternalLink } from "react-icons/lu";
import { useRecceInstanceContext } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { connectToCloud } from "../../lib/api/connectToCloud";

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

interface AuthModalProps {
  handleParentClose?: Dispatch<SetStateAction<boolean>>;
  parentOpen?: boolean;
  ignoreCookie?: boolean;
  variant?: "auth" | "enable-share" | "user-profile";
}

export default function AuthModal({
  handleParentClose,
  parentOpen = false,
  ignoreCookie = false,
  variant = "auth",
}: AuthModalProps): ReactNode {
  const { authed } = useRecceInstanceContext();
  const { apiClient } = useApiConfig();
  const [open, setOpen] = useState(parentOpen || !authed);

  // Cookie handling only for auth variant
  const authStateCookieValue = (Cookies.get("authState") ??
    "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(
    ignoreCookie ? "pending" : authStateCookieValue,
  );

  if (authState === "ignored" && !ignoreCookie) {
    return null;
  }

  if (authed) {
    return null;
  }

  // Content configuration based on variant
  const contents = {
    auth: {
      title: "Configure Cloud Token",
      action: "Get token and configure",
    },
    "enable-share": {
      title: "Enable Sharing with Cloud",
      action: "Enable sharing",
    },
    "user-profile": {
      title: "Configure Cloud Token",
      action: "Get token and configure",
    },
  };

  const content = contents[variant];

  const handleClose = () => {
    setOpen(false);
    if (handleParentClose) {
      handleParentClose(false);
    }
  };

  return (
    <MuiDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: "1rem" } },
      }}
    >
      {authState !== "authenticating" && (
        <DialogTitle sx={{ textAlign: "center", fontSize: "1.5rem" }}>
          {content.title}
        </DialogTitle>
      )}
      {authState !== "authenticating" ? (
        <>
          <DialogContent className="space-y-2 font-light">
            <Typography>
              To enable sharing, get your token from Recce Cloud and launch your
              local instance with it.
            </Typography>
            <ul className="list-inside list-disc">
              <li>Share your instance with teammates via Recce Cloud.</li>
              <li>
                Your instance will be securely and freely hosted for sharing.
              </li>
              {variant === "auth" && (
                <li>This step is recommended but optional.</li>
              )}
            </ul>
            <Box sx={{ display: "flex", gap: 1 }}>
              More directions
              <Link
                underline="always"
                sx={{
                  color: "primary.main",
                  "&:focus": { outline: "none" },
                }}
                href="https://cloud.datarecce.io/connect-to-cloud"
                target="_blank"
              >
                here <LuExternalLink style={{ display: "inline" }} />
              </Link>
            </Box>
          </DialogContent>
          <DialogActions sx={{ flexDirection: "column", gap: 1, px: 3, pb: 3 }}>
            <Button
              fullWidth
              color="brand"
              variant="contained"
              sx={{ borderRadius: 2, fontWeight: 500 }}
              onClick={async () => {
                setAuthState("authenticating");
                const { connection_url } = await connectToCloud(apiClient);
                // Open the connection URL in a new tab
                window.open(connection_url, "_blank");
              }}
            >
              {content.action} <LuExternalLink style={{ marginLeft: 4 }} />
            </Button>
            <Button
              fullWidth
              color="neutral"
              variant="text"
              size="small"
              sx={{ borderRadius: 2, fontWeight: 500 }}
              onClick={handleClose}
            >
              {variant === "auth" ? "Skip" : "Cancel"}
            </Button>
            {variant === "auth" && (
              <Button
                fullWidth
                variant="text"
                size="small"
                sx={{ borderRadius: 2, fontWeight: 500, color: "text.primary" }}
                onClick={() => {
                  Cookies.set("authState", "ignored", {
                    expires: 30,
                  });
                  setAuthState("ignored");
                  handleClose();
                }}
              >
                Snooze for 30 days
              </Button>
            )}
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent className="space-y-2 self-center font-light">
            <Stack spacing={2} alignItems="center" sx={{ pt: "1rem" }}>
              <Box
                component="img"
                sx={{ height: "6rem", objectFit: "contain", mx: "auto", mb: 1 }}
                src="/imgs/reload-image.svg"
                alt="Reload"
              />
              <Typography sx={{ fontSize: "1.5rem", fontWeight: 500 }}>
                Reload to Finish
              </Typography>
              <Typography>
                Reload to complete connection to Recce Cloud
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button
              fullWidth
              color="brand"
              variant="contained"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload
            </Button>
          </DialogActions>
        </>
      )}
    </MuiDialog>
  );
}
