import { Button, CloseButton, Dialog, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import React from "react";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { RecceFeatureMode } from "@/lib/hooks/RecceInstanceContext";

interface ServerDisconnectedModalContentProps {
  connect: () => void;
  /** If provided, indicates the server was idle for this many seconds before timeout */
  idleSeconds?: number | null;
}

/**
 * Format seconds into human-readable format
 * - Less than 1 minute: "30 seconds"
 * - 1+ minutes: "5 minutes", "1 hour 30 minutes"
 */
function formatIdleTime(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // Less than 1 minute - show seconds
  if (totalMinutes < 1) {
    const secs = Math.floor(seconds);
    return `${secs} second${secs !== 1 ? "s" : ""}`;
  }

  // 1+ hours
  if (hours > 0) {
    if (remainingMinutes > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  // Minutes only
  return `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}`;
}

export function ServerDisconnectedModalContent({
  connect,
  idleSeconds,
}: ServerDisconnectedModalContentProps) {
  const isIdleTimeout = idleSeconds !== undefined && idleSeconds !== null;

  return (
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Server Disconnected</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        {isIdleTimeout ? (
          <Text>
            The server has been idle for {formatIdleTime(idleSeconds)} and was
            automatically stopped. Please restart the Recce server to continue.
          </Text>
        ) : (
          <Text>
            The server connection has been lost. Please restart the Recce server
            and try again.
          </Text>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button
          colorPalette="iochmara"
          onClick={() => {
            connect();
          }}
        >
          Retry
        </Button>
      </Dialog.Footer>
      <Dialog.CloseTrigger asChild>
        <CloseButton size="sm" />
      </Dialog.CloseTrigger>
    </Dialog.Content>
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
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>{content.title}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Text>{content.body}</Text>
      </Dialog.Body>
      <Dialog.Footer>
        {mode === "read only" ? (
          <NextLink href={content.link} passHref>
            <Button colorPalette="blue">{content.action}</Button>
          </NextLink>
        ) : (
          <Button
            colorPalette="blue"
            onClick={() => window.open(content.link, "_blank")}
          >
            {content.action}
          </Button>
        )}
      </Dialog.Footer>
    </Dialog.Content>
  );
}
