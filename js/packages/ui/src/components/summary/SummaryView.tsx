"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useLineageGraphContext } from "../../contexts";
import { ChangeSummary } from "./ChangeSummary";
import { SchemaSummary } from "./SchemaSummary";

export function SummaryView() {
  const { lineageGraph } = useLineageGraphContext();
  return (
    <>
      <Stack sx={{ width: "100%", minHeight: "650px" }}>
        <Box sx={{ width: "100%", pb: "10px", mb: "20px" }}>
          <Typography variant="h5" sx={{ fontSize: 24 }}>
            Change Summary
          </Typography>
        </Box>
        {lineageGraph && (
          <>
            <ChangeSummary lineageGraph={lineageGraph} />
            <Divider />
            <SchemaSummary lineageGraph={lineageGraph} />
          </>
        )}
      </Stack>
    </>
  );
}
