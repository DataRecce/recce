import { Box, Flex, Icon, Tooltip } from "@chakra-ui/react";

import { getIconForChangeStatus } from "./styles";
import { TransformationType } from "./GraphColumnNode";

export function ColumnLevelLineageLegend() {
  const TRANSFORMATION_MSGS: {
    [key: string]: [string, string];
  } = {
    passthrough: [
      "Pass Through",
      "Use the same column name and definition from upstream.",
    ],
    renamed: ["Renamed", "Use a different column name from upstream."],
    derived: ["Derived", "Transformed from upstream one or more columns."],
    source: ["Source", "The original source column."],
    unknown: [
      "Unknown",
      "Parse error, or un supported model type, or other unknown error.",
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
          <Tooltip label={tip} key={key}>
            <Flex alignItems="center" gap="6px" marginBottom="2px">
              <TransformationType legend transformationType={key} /> {label}
            </Flex>
          </Tooltip>
        );
      })}
    </Box>
  );
}
