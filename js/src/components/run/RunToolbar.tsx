import Box from "@mui/material/Box";
import _ from "lodash";
import { ReactNode } from "react";
import { PiWarning } from "react-icons/pi";
import { RunResultViewProps } from "./types";

export interface DiffViewOptions {
  changed_only?: boolean;
}

interface RunToolbarProps<VO> extends RunResultViewProps<VO> {
  warnings?: string[];
  children?: ReactNode;
}

export const RunToolbar = ({
  warnings,
  children,
}: RunToolbarProps<DiffViewOptions>) => {
  return (
    <Box
      sx={{
        display: "flex",
        borderBottom: "1px solid lightgray",
        justifyContent: "flex-end",
        gap: "5px",
        alignItems: "center",
        px: "10px",
        bgcolor: warnings && warnings.length > 0 ? "amber.100" : "inherit",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        {warnings?.map((warning) => (
          <Box key={_.uniqueId(`-${warning}`)}>
            <PiWarning color="amber.600" /> {warning}
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: "32px" }} />
      {children}
    </Box>
  );
};
