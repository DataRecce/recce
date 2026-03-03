"use client";

import Box, { type BoxProps } from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import { PiInfo } from "react-icons/pi";
import type { NodeColumnData } from "../../api";
import { useLineageGraphContext } from "../../contexts";
import { DropdownValuesInput } from "../ui/DropdownValuesInput";

export interface QueryFormProps extends BoxProps {
  defaultPrimaryKeys: string[] | undefined;
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

export const QueryForm = ({
  defaultPrimaryKeys,
  onPrimaryKeysChange,
  ...props
}: QueryFormProps) => {
  const { lineageGraph, isActionAvailable } = useLineageGraphContext();

  const labelInfo =
    "Provide a primary key to perform query diff in data warehouse and only return changed rows.";

  const availableColumns = useMemo(() => {
    if (!lineageGraph) {
      return [];
    }
    const columnSet = new Set<string>();
    for (const modelName in lineageGraph.nodes) {
      const model = lineageGraph.nodes[modelName];
      const combinedColumns: Record<string, NodeColumnData | undefined> = {
        ...(model.data.data.base?.columns ?? {}),
        ...(model.data.data.current?.columns ?? {}),
      };

      Object.entries(combinedColumns).forEach(([columnName, col]) => {
        if (col?.unique) {
          columnSet.add(columnName);
        }
      });
    }
    return Array.from(columnSet).sort();
  }, [lineageGraph]);

  return (
    <Box sx={{ display: "flex" }} {...props}>
      <Stack spacing={0} sx={{ m: "0 0.5rem" }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            component="label"
            sx={{ fontSize: "0.625rem", color: "text.secondary" }}
          >
            Diff with Primary Key(s) (suggested)
          </Typography>
          <MuiTooltip title={labelInfo} placement="bottom-end">
            <Box
              component="span"
              sx={{ display: "flex", color: "grey.600", cursor: "help" }}
            >
              <PiInfo fontSize="0.75rem" />
            </Box>
          </MuiTooltip>
        </Stack>
        <DropdownValuesInput
          className="no-track-pii-safe"
          unitName="key"
          defaultValues={defaultPrimaryKeys}
          suggestionList={availableColumns}
          onValuesChange={onPrimaryKeysChange}
          size="2xs"
          width={"240px"}
          placeholder="Select or type to add keys"
          disabled={!isActionAvailable("query_diff_with_primary_key")}
        />
      </Stack>
    </Box>
  );
};
