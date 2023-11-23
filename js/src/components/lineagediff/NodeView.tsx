import { Box } from "@chakra-ui/react";
import { LineageGraphNode, NodeData } from "./lineagediff";
import { SchemaView } from "../schemadiff/SchemaView";

interface NodeViewProps {
  node: LineageGraphNode;
}

export function NodeView({ node }: NodeViewProps) {
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";

  return (
    <Box>
      <Box>{node.name}</Box>
      <Box>{node.resourceType}</Box>
      {withColumns && (
        <Box>
          <Box>Columns</Box>
          <Box>
            <SchemaView
              base={node.data.base?.columns}
              current={node.data.current?.columns}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
