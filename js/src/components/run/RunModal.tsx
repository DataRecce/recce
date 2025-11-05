import { Run, RunType } from "@/lib/api/types";

import {
  Box,
  Button,
  CloseButton,
  Dialog,
  Flex,
  Icon,
  IconButton,
  Link,
  Popover,
  Portal,
} from "@chakra-ui/react";
import { RunFormProps } from "./types";
import { useState } from "react";
import { IconInfo } from "@/components/icons";

interface RunModalProps<PT> {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (type: RunType, params: PT) => void;
  title: string;
  type: RunType;
  params: PT;
  initialRun?: Run;
  RunForm?: React.ComponentType<RunFormProps<PT>>;
}

const getDocumentationUrl = (type: RunType): string | null => {
  const urlMap: Record<string, string> = {
    value_diff: "https://docs.datarecce.io/features/lineage/#value-diff",
    profile_diff: "https://docs.datarecce.io/features/lineage/#profile-diff",
    histogram_diff: "https://docs.datarecce.io/features/lineage/#histogram-diff",
    top_k_diff: "https://docs.datarecce.io/features/lineage/#top-k-diff",
  };
  return urlMap[type] || null;
};

export const RunModal = <PT,>({
  isOpen,
  onClose,
  onExecute,
  type,
  title,
  params: defaultParams,
  RunForm,
}: RunModalProps<PT>) => {
  const [params, setParams] = useState<Partial<PT>>(defaultParams);
  const [hovered, setHovered] = useState(false);
  const [isReadyToExecute, setIsReadyToExecute] = useState(false);
  const documentationUrl = getDocumentationUrl(type);

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose} size="xl" scrollBehavior="inside">
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content overflowY="auto" height="75%" minHeight={"400px"}>
            <Dialog.Header>
              <Dialog.Title display="flex" alignItems="center">
                {title}{" "}
                {documentationUrl && (
                  <Popover.Root
                    positioning={{ placement: "bottom-end" }}
                    open={hovered}
                    onFocusOutside={() => {
                      setHovered(false);
                    }}>
                    <Popover.Trigger asChild>
                      <IconButton
                        display="flex"
                        size="sm"
                        variant="plain"
                        aria-label="Click this button to learn more about the SQL behind"
                        onMouseEnter={() => {
                          setHovered(true);
                        }}
                        onClick={() => window.open(documentationUrl, "_blank")}
                        onFocus={(e) => {
                          e.preventDefault();
                        }}>
                        <Icon verticalAlign="middle" as={IconInfo} boxSize={"16px"} />
                      </IconButton>
                    </Popover.Trigger>
                    <Popover.Positioner>
                      <Popover.Content bg="black" color="white">
                        <Popover.Body fontSize="sm" p={2}>
                          Click{" "}
                          <Link
                            href={documentationUrl}
                            target="_blank"
                            textDecoration="underline"
                            color="white"
                            _hover={{ color: "blue.300" }}>
                            here
                          </Link>{" "}
                          to learn more about the SQL behind
                        </Popover.Body>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover.Root>
                )}
              </Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body p="0px" h="100%" overflow="auto" borderY="1px solid lightgray">
              <Box style={{ contain: "layout" }}>
                {RunForm && (
                  <RunForm
                    params={params}
                    onParamsChanged={setParams}
                    setIsReadyToExecute={setIsReadyToExecute}
                  />
                )}
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap="10px">
                <Button
                  disabled={!isReadyToExecute}
                  colorPalette="blue"
                  onClick={() => {
                    onExecute(type, params as PT);
                  }}>
                  Execute
                </Button>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
