import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { Box, useDisclosure } from "@chakra-ui/react";
import { useEffect } from "react";
import { VSplit } from "../split/Split";
import { LineageView } from "./LineageView";
import { ReactFlowProvider } from "reactflow";
import { RunResultPane } from "../run/RunResultPane";

export function LineagePage() {
  const { isOpen, close } = useRecceActionContext();

  return (
    <ReactFlowProvider>
      <VSplit
        sizes={isOpen ? [50, 50] : [100, 0]}
        minSize={isOpen ? 100 : 0}
        style={{ height: "100%", borderTop: "1px solid #CBD5E0" }}
      >
        <Box>
          <LineageView viewMode="changed_models" interactive />
        </Box>

        {isOpen ? <RunResultPane onClose={close} /> : <Box></Box>}
      </VSplit>
    </ReactFlowProvider>
  );
}
