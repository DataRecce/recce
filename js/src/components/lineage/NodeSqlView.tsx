import { useDisclosure, Box, IconButton, CloseButton, Portal, Dialog } from "@chakra-ui/react";
import React, { useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { LineageGraphNode } from "./lineage";
import { DiffEditor, DiffEditorProps, Editor, EditorProps } from "@monaco-editor/react";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import SqlEditor from "../query/SqlEditor";

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

  if (node.resourceType !== "model" && node.resourceType !== "snapshot") {
    return "Not available";
  }

  const diffOptions: DiffEditorProps["options"] = {
    readOnly: true,
    lineNumbers: "on",
    automaticLayout: true,
    renderOverviewRuler: false,
    wordWrap: "off",
    minimap: { enabled: false },
  };
  const sqlOptions: EditorProps["options"] = {
    readOnly: true,
    lineNumbers: "on",
    automaticLayout: true,
    wordWrap: "off",
    minimap: { enabled: false },
  };

  const original = node.data.base?.raw_code;
  const modified = node.data.current?.raw_code;
  const modelName = node.data.base?.name ?? node.data.current?.name ?? "";

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
      }}>
      {isSingleEnvOnboarding ? (
        <SqlEditor language="sql" theme="vs" value={original ?? ""} options={sqlOptions} />
      ) : (
        <DiffEditor
          language="sql"
          theme="vs"
          original={original}
          modified={modified}
          options={{
            ...diffOptions,
            renderSideBySide: false,
          }}
        />
      )}
      <IconButton
        onClick={onOpen}
        size="md"
        aria-label={""}
        variant={"ghost"}
        style={{
          position: "absolute",
          top: "5px",
          right: "20px",
          opacity: isHovered ? 0.5 : 0.1,
          transition: "opacity 0.3s ease-in-out",
        }}>
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
              </Dialog.Header>
              <Dialog.Body>
                {isSingleEnvOnboarding ? (
                  <Editor
                    language="sql"
                    theme="vs"
                    value={original ?? ""}
                    options={{ ...sqlOptions, fontSize: 16 }}
                  />
                ) : (
                  <DiffEditor
                    language="sql"
                    theme="vs"
                    original={original}
                    modified={modified}
                    options={{ ...diffOptions, fontSize: 16 }}
                  />
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
          <Dialog.CloseTrigger asChild>
            <CloseButton size="sm" />
          </Dialog.CloseTrigger>
        </Portal>
      </Dialog.Root>
    </Box>
  );
};
