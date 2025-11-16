import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Portal,
  useDisclosure,
} from "@chakra-ui/react";
import React, { useCallback, useRef, useState } from "react";

function useValueDiffAlertDialog() {
  const { open, onOpen, onClose } = useDisclosure();
  const [nodeCount, setNodeCount] = useState(0);
  const [resolvePromise, setResolvePromise] =
    useState<(value: boolean) => void>();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (nodeCount: number) => {
      setNodeCount(nodeCount);
      return new Promise<boolean>((resolve) => {
        setResolvePromise(() => resolve);
        onOpen();
      });
    },
    [onOpen],
  );

  const handleConfirm = () => {
    resolvePromise?.(true);
    onClose();
  };

  const handleCancel = () => {
    resolvePromise?.(false);
    onClose();
  };

  const ValueDiffAlertDialog = (
    <Dialog.Root
      size={"xl"}
      open={open}
      role="alertdialog"
      initialFocusEl={() => {
        return cancelRef.current;
      }}
      onOpenChange={handleCancel}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header fontSize="lg" fontWeight="bold">
              <Dialog.Title>Value Diff on {nodeCount} nodes</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body gap="20px" as={Flex} direction="column">
              <Box>
                Value diff will be executed on {nodeCount} nodes in the Lineage,
                which can add extra costs to your bill.
              </Box>
            </Dialog.Body>

            <Dialog.Footer gap={1}>
              <Button
                ref={cancelRef}
                onClick={handleCancel}
                variant="outline"
                colorPalette="gray"
              >
                Cancel
              </Button>
              <Button colorPalette="iochmara" onClick={handleConfirm} ml={3}>
                Execute
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );

  return { confirm, AlertDialog: ValueDiffAlertDialog };
}

export default useValueDiffAlertDialog;
