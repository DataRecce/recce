import type { RecceFeatureMode } from "@datarecce/ui/contexts";
import { formatDuration } from "@datarecce/ui/utils";
import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import React from "react";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";

interface ServerDisconnectedModalContentProps {
  connect: () => void;
  /** If provided, indicates the server was idle for this many seconds before timeout */
  idleSeconds?: number | null;
}

export function ServerDisconnectedModalContent({
  connect,
  idleSeconds,
}: ServerDisconnectedModalContentProps) {
  const isIdleTimeout =
    idleSeconds !== undefined && idleSeconds !== null && idleSeconds > 0;

  return (
    <>
      <DialogTitle>Server Disconnected</DialogTitle>
      <DialogContent>
        {isIdleTimeout ? (
          <Typography>
            The server has been idle for {formatDuration(idleSeconds)} and was
            automatically stopped. Please restart the Recce server to continue.
          </Typography>
        ) : (
          <Typography>
            The server connection has been lost. Please restart the Recce server
            and try again.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          color="iochmara"
          variant="contained"
          onClick={() => {
            connect();
          }}
        >
          Retry
        </Button>
      </DialogActions>
    </>
  );
}

export function RecceInstanceDisconnectedModalContent({
  shareUrl,
  mode,
}: {
  shareUrl: string;
  mode: Exclude<RecceFeatureMode, null>;
}) {
  const contents = {
    "read only": {
      title: "Share Instance Expired",
      body: "This Share Instance has expired. Please restart the share instance.",
      action: "Restart",
      link: shareUrl,
    },
    "metadata only": {
      title: "Preview Instance Expired",
      body: "This Preview Instance has expired. To browse more, please book a meeting with us.",
      action: "Contact us",
      link: RECCE_SUPPORT_CALENDAR_URL,
    },
  };

  const content = contents[mode];

  return (
    <>
      <DialogTitle>{content.title}</DialogTitle>
      <DialogContent>
        <Typography>{content.body}</Typography>
      </DialogContent>
      <DialogActions>
        {mode === "read only" ? (
          <NextLink href={content.link} passHref>
            <Button color="iochmara" variant="contained">
              {content.action}
            </Button>
          </NextLink>
        ) : (
          <Button
            color="iochmara"
            variant="contained"
            onClick={() => window.open(content.link, "_blank")}
          >
            {content.action}
          </Button>
        )}
      </DialogActions>
    </>
  );
}
