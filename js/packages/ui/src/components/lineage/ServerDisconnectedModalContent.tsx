"use client";

import Button from "@mui/material/Button";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import type { ComponentType, ReactNode } from "react";
import type { RecceFeatureMode } from "../../contexts/instance";
import { formatDuration } from "../../utils/formatTime";

/**
 * Props for the ServerDisconnectedModalContent component
 */
export interface ServerDisconnectedModalContentProps {
  /** Callback to attempt reconnection */
  connect: () => void;
  /** If provided, indicates the server was idle for this many seconds before timeout */
  idleSeconds?: number | null;
}

/**
 * Modal content displayed when the local server connection is lost.
 * Shows different messages for idle timeout vs unexpected disconnection.
 */
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

/**
 * Props for a link component that can wrap children
 */
export interface LinkComponentProps {
  href: string;
  children: ReactNode;
}

/**
 * Props for the RecceInstanceDisconnectedModalContent component
 */
export interface RecceInstanceDisconnectedModalContentProps {
  /** URL to restart the share instance */
  shareUrl: string;
  /** The feature mode (determines which message to display) */
  mode: Exclude<RecceFeatureMode, null>;
  /** URL for scheduling support calls (used in metadata-only mode) */
  supportCalendarUrl: string;
  /**
   * Optional link component for routing integration (e.g., Next.js Link).
   * If provided, used for "read only" mode navigation.
   * Should pass `href` to child and handle routing.
   */
  LinkComponent?: ComponentType<LinkComponentProps>;
}

/**
 * Modal content displayed when a cloud instance expires.
 * Shows different messages based on the feature mode:
 * - "read only": Share instance expired, offers restart
 * - "metadata only": Preview instance expired, offers contact option
 */
export function RecceInstanceDisconnectedModalContent({
  shareUrl,
  mode,
  supportCalendarUrl,
  LinkComponent,
}: RecceInstanceDisconnectedModalContentProps) {
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
      link: supportCalendarUrl,
    },
  };

  const content = contents[mode];

  const button = (
    <Button color="iochmara" variant="contained">
      {content.action}
    </Button>
  );

  return (
    <>
      <DialogTitle>{content.title}</DialogTitle>
      <DialogContent>
        <Typography>{content.body}</Typography>
      </DialogContent>
      <DialogActions>
        {mode === "read only" ? (
          LinkComponent ? (
            <LinkComponent href={content.link}>{button}</LinkComponent>
          ) : (
            <a href={content.link}>{button}</a>
          )
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
