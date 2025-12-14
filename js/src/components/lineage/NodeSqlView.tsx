import {
  Box,
  CloseButton,
  Dialog,
  IconButton,
  Portal,
  useDisclosure,
} from "@/components/ui/mui";
import React, { useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { CodeEditor, DiffEditor } from "@/components/editor";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { LineageGraphNode } from "./lineage";

interface NodeSqlViewProps {
  node: LineageGraphNode;
}

export const NodeSqlView = ({ node }: NodeSqlViewProps) => {
  const { open: isOpen, onOpen: onOpen, onClose: onClose } = useDisclosure();
  const [isHovered, setIsHovered] = useState(false);
  const { data: flags, isLoading } = useRecceServerFlag();
  const isSingleEnvOnboarding = flags?.single_env_onboarding;

  if (isLoading) {
    return <></>;
  }

  if (
    node.data.resourceType !== "model" &&
    node.data.resourceType !== "snapshot"
  ) {
    return "Not available";
  }

  const original = node.data.data.base?.raw_code;
  const modified = node.data.data.current?.raw_code;
  const modelName =
    node.data.data.base?.name ?? node.data.data.current?.name ?? "";

  return (
    <Box
      className="no-track-pii-safe"
      style={{ position: "relative" }}
      height="100%"
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      {isSingleEnvOnboarding ? (
        <CodeEditor
          language="sql"
          value={original ?? ""}
          readOnly={true}
          lineNumbers={true}
          wordWrap={false}
        />
      ) : (
        <DiffEditor
          original={original ?? ""}
          modified={modified ?? ""}
          language="sql"
          readOnly={true}
          lineNumbers={true}
          sideBySide={false} // Inline diff mode
          height="100%"
        />
      )}
      <IconButton
        onClick={onOpen}
        size="md"
        aria-label="Expand"
        variant={"ghost"}
        style={{
          position: "absolute",
          top: "5px",
          right: "20px",
          opacity: isHovered ? 0.5 : 0.1,
          transition: "opacity 0.3s ease-in-out",
        }}
      >
        <FaExpandArrowsAlt />
      </IconButton>
      <Dialog.Root open={isOpen} onOpenChange={onClose} size="xl">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content overflowY="auto" height="75%">
              <Dialog.Header>
                {isSingleEnvOnboarding ? (
                  <Dialog.Title>
                    <code>{modelName}</code> Model Code
                  </Dialog.Title>
                ) : (
                  <Dialog.Title>
                    <code>{modelName}</code> Model Code Diff
                  </Dialog.Title>
                )}
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                {isSingleEnvOnboarding ? (
                  <CodeEditor
                    language="sql"
                    value={original ?? ""}
                    fontSize={16}
                    readOnly={true}
                    lineNumbers={true}
                    wordWrap={false}
                  />
                ) : (
                  <DiffEditor
                    original={original ?? ""}
                    modified={modified ?? ""}
                    language="sql"
                    className="text-base"
                  />
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
};
