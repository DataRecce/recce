import {
  useDisclosure,
  Box,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { LineageGraphNode } from "./lineage";
import { DiffEditor, DiffEditorProps, Editor, EditorProps } from "@monaco-editor/react";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import SqlEditor from "../query/SqlEditor";

interface NodeSqlViewProps {
  node: LineageGraphNode;
}

export const NodeSqlView = ({ node }: NodeSqlViewProps) => {
  const { isOpen: isOpen, onOpen: onOpen, onClose: onClose } = useDisclosure();
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

  return (
    <Box
      style={{ position: "relative", padding: "10px" }}
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
        icon={<FaExpandArrowsAlt />}
        onClick={onOpen}
        size="md"
        aria-label={""}
        variant={"ghost"}
        style={{
          position: "absolute",
          top: "10px",
          right: "30px",
          opacity: isHovered ? 0.5 : 0.1,
          transition: "opacity 0.3s ease-in-out",
        }}
      />
      <Modal isOpen={isOpen} onClose={onClose} size="6xl">
        <ModalOverlay />
        <ModalContent overflowY="auto" height="75%">
          <ModalHeader>
            {isSingleEnvOnboarding ? "Model Raw Code" : "Model Raw Code Diff"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
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
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};
