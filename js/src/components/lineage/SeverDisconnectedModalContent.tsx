import { Button, CloseButton, Dialog, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import React from "react";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { RecceFeatureMode } from "@/lib/hooks/RecceInstanceContext";

export function ServerDisconnectedModalContent({
  connect,
}: {
  connect: () => void;
}) {
  return (
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Server Disconnected</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Text>
          The server connection has been lost. Please restart the Recce server
          and try again.
        </Text>
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
