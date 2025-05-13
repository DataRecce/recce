import { Button, ModalBody, ModalContent, ModalFooter, ModalHeader, Text } from "@chakra-ui/react";
import NextLink from "next/link";

export function ServerDisconnectedModalContent({ connect }: { connect: () => void }) {
  return (
    <ModalContent>
      <ModalHeader>Server Disconnected</ModalHeader>
      <ModalBody>
        <Text>
          The server connection has been lost. Please restart the Recce server and try again.
        </Text>
      </ModalBody>
      <ModalFooter>
        <Button
          colorScheme="blue"
          onClick={() => {
            connect();
          }}>
          Retry
        </Button>
      </ModalFooter>
    </ModalContent>
  );
}

export function RecceShareInstanceDisconnectedModalContent({ shareUrl }: { shareUrl: string }) {
  return (
    <ModalContent>
      <ModalHeader>Share Instance Expired</ModalHeader>
      <ModalBody>
        <Text>This Share Instance has expired. Please restart the share instance.</Text>
      </ModalBody>
      <ModalFooter>
        <NextLink href={shareUrl} passHref>
          <Button colorScheme="blue">Restart</Button>
        </NextLink>
      </ModalFooter>
    </ModalContent>
  );
}
