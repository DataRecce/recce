import { Button, CloseButton, Dialog, Text } from "@chakra-ui/react";
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
          colorPalette="cyan"
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

export function RecceShareInstanceDisconnectedModalContent({ shareUrl }: { shareUrl: string }) {
  return (
    <Dialog.Content>
      <Dialog.Header>
        <Dialog.Title>Share Instance Expired</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <Text>This Share Instance has expired. Please restart the share instance.</Text>
      </Dialog.Body>
      <Dialog.Footer>
        <NextLink href={shareUrl} passHref>
          <Button colorPalette="blue">Restart</Button>
        </NextLink>
      </Dialog.Footer>
    </Dialog.Content>
  );
}
