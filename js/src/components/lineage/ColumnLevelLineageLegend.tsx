import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
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
      sx={{
        bgcolor: "background.paper",
        padding: "12px",
        border: "1px solid",
        borderColor: "divider",
        fontSize: "0.875rem",
      }}
    >
      {Object.entries(TRANSFORMATION_MSGS).map(([key, [label, tip]]) => {
        return (
          <Tooltip title={tip} key={key} placement="right">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                mb: "2px",
              }}
            >
              <TransformationType legend transformationType={key} /> {label}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
