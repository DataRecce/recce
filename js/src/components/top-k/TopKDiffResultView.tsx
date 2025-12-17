import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { forwardRef, Ref, useState } from "react";
import { TopKDiffParams, TopKDiffResult } from "@/lib/api/profile";
import { TopKSummaryBarChart } from "../charts/TopKSummaryList";
import { RunResultViewProps } from "../run/types";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";

type TopKDiffResultViewProp = RunResultViewProps;

const PrivateTopKDiffResultView = (
  { run }: TopKDiffResultViewProp,
  ref: Ref<HTMLDivElement>,
) => {
  const [isDisplayTopTen, setIsDisplayTopTen] = useState<boolean>(true);
  // TODO: Implement TopKDiffResultView
  const result = run.result as TopKDiffResult;
  const params = run.params as TopKDiffParams;

  const baseTopK = result.base;
  const currentTopK = result.current;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenshotBox ref={ref} blockSize={"auto"}>
        <Typography
          variant="h5"
          sx={{ pt: 4, textAlign: "center", color: "grey.600" }}
        >
          Model {params.model}.{params.column_name}
        </Typography>
        <Stack direction="row" alignItems="center">
          <Box sx={{ flex: 1 }} />
          <TopKSummaryBarChart
            topKDiff={result}
            valids={currentTopK.valids || 0}
            isDisplayTopTen={isDisplayTopTen}
          />
          <Box sx={{ flex: 1 }} />
        </Stack>
      </ScreenshotBox>
      <Box sx={{ flex: 1 }} />
      {(baseTopK.values.length > 10 || currentTopK.values.length > 10) && (
        <Box sx={{ display: "flex", p: 5, justifyContent: "start" }}>
          <Link
            component="button"
            onClick={() => {
              setIsDisplayTopTen((prevState) => !prevState);
            }}
            sx={{ color: "iochmara.main", cursor: "pointer" }}
          >
            {isDisplayTopTen ? "View More Items" : "View Only Top-10"}
          </Link>
        </Box>
      )}
    </Box>
  );
};

export const TopKDiffResultView = forwardRef(PrivateTopKDiffResultView);
