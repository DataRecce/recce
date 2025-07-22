import { Button, CloseButton, Dialog, Link, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import React from "react";

export function ServerDisconnectedModalContent({ connect }: { connect: () => void }) {
  return (
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Server Disconnected</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Text>
          The server connection has been lost. Please restart the Recce server and try again.
        </Text>
      </Dialog.Body>
      <Dialog.Footer>
        <Button
          colorPalette="iochmara"
          onClick={() => {
            connect();
          }}>
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
  mode: "read only" | "preview mode";
}) {
  const contents = {
    "read only": {
      title: "Share Instance Expired",
      body: "This Share Instance has expired. Please restart the share instance.",
      action: "Restart",
      link: shareUrl,
    },
    "preview mode": {
      title: "Preview Instance Expired",
      body: "This Preview Instance has expired. To browse more, please book a meeting with us.",
      action: "Contact us",
      link: "https://cloud.datarecce.io/",
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
        <NextLink href={content.link} passHref>
          <Button colorPalette="blue">{content.action}</Button>
        </NextLink>
      </Dialog.Footer>
    </Dialog.Content>
  );
}
