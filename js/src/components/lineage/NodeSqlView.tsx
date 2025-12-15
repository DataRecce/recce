import Box from "@mui/material/Box";
import MuiDialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import React, { useState } from "react";
import { FaExpandArrowsAlt } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { CodeEditor, DiffEditor } from "@/components/editor";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { LineageGraphNode } from "./lineage";

interface NodeSqlViewProps {
  node: LineageGraphNode;
}

export const NodeSqlView = ({ node }: NodeSqlViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
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
      sx={{ position: "relative", height: "100%" }}
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
        onClick={() => setIsOpen(true)}
        size="medium"
        aria-label="Expand"
        sx={{
          position: "absolute",
          top: "5px",
          right: "20px",
          opacity: isHovered ? 0.5 : 0.1,
          transition: "opacity 0.3s ease-in-out",
        }}
      >
        <FaExpandArrowsAlt />
      </IconButton>
      <MuiDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: "75%", overflowY: "auto" },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          {isSingleEnvOnboarding ? (
            <>
              <code>{modelName}</code>&nbsp;Model Code
            </>
          ) : (
            <>
              <code>{modelName}</code>&nbsp;Model Code Diff
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setIsOpen(false)}>
            <IoClose />
          </IconButton>
        </DialogTitle>
        <DialogContent>
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
        </DialogContent>
      </MuiDialog>
    </Box>
  );
};
