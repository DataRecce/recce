import { Box, Flex } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { TransformationType } from "./GraphColumnNode";

export function ColumnLevelLineageLegend() {
  const TRANSFORMATION_MSGS: Record<string, [string, string]> = {
    passthrough: [
      "Pass Through",
      "The column is directly selected from the upstream table.",
    ],
    renamed: [
      "Renamed",
      "The column is selected from the upstream table but with a different name.",
    ],
    derived: [
      "Derived",
      "The column is created through transformations applied to upstream columns, such as calculations, conditions, functions, or aggregations.",
    ],
    source: [
      "Source",
      "The column is not derived from any upstream data. It may originate from a seed/source node, literal value, or data generation function.",
    ],
    unknown: [
      "Unknown",
      "We have no information about the transformation type. This could be due to a parse error, or other unknown reason.",
    ],
  };

  return (
    <Box
      bg="white"
      padding="12px"
      borderWidth="1px"
      borderColor="gray.200"
      fontSize="sm"
    >
      {Object.entries(TRANSFORMATION_MSGS).map(([key, [label, tip]]) => {
        return (
          <Tooltip content={tip} key={key} positioning={{ placement: "right" }}>
            <Flex alignItems="center" gap="6px" marginBottom="2px">
              <TransformationType legend transformationType={key} /> {label}
            </Flex>
          </Tooltip>
        );
      })}
    </Box>
  );
}
