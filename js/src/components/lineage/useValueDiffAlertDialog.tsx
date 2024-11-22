import {
  useDisclosure,
  Button,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  Box,
  Alert,
  AlertIcon,
  Flex,
} from "@chakra-ui/react";
import React, { useRef, useState, useCallback } from "react";

function useValueDiffAlertDialog() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [nodeCount, setNodeCount] = useState(0);
  const [resolvePromise, setResolvePromise] =
    useState<(value: boolean) => void>();
  const cancelRef = useRef<any>();

  const confirm = useCallback(
    (nodeCount: number) => {
      setNodeCount(nodeCount);
      return new Promise<boolean>((resolve) => {
        setResolvePromise(() => resolve);
        onOpen();
      });
    },
    [onOpen]
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
    <AlertDialog
      size={"xl"}
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={handleCancel}
    >
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader fontSize="lg" fontWeight="bold">
            Value Diff on {nodeCount} nodes
          </AlertDialogHeader>

          <AlertDialogBody gap="20px" as={Flex} direction="column">
            <Box>
              Value diff will be executed on {nodeCount} nodes in the Lineage,
              which can add extra costs to your bill.
            </Box>
            <Alert title="Alert Title" status="info" alignItems="flex-start">
              <AlertIcon />
              You can cancel anytime if the data warehouse supports this action
              (BigQuery cannot be cancelled).
            </Alert>
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button ref={cancelRef} onClick={handleCancel}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleConfirm} ml={3}>
              Execute
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );

  return { confirm, AlertDialog: ValueDiffAlertDialog };
}

export default useValueDiffAlertDialog;
