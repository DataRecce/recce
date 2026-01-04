import { useIsDark } from "@datarecce/ui/hooks";
import Box from "@mui/material/Box";
import _ from "lodash";
import { ReactNode } from "react";
import { PiWarning } from "react-icons/pi";
import { colors } from "@/components/ui/mui-theme";
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
  const isDark = useIsDark();
  const hasWarnings = warnings && warnings.length > 0;

  return (
    <Box
      sx={{
        display: "flex",
        borderBottom: "1px solid",
        borderColor: "divider",
        justifyContent: "flex-end",
        gap: "5px",
        alignItems: "center",
        px: "10px",
        bgcolor: hasWarnings
          ? isDark
            ? colors.amber[900]
            : colors.amber[100]
          : "inherit",
        color: hasWarnings
          ? isDark
            ? colors.amber[200]
            : colors.amber[800]
          : "inherit",
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
            <PiWarning
              color={isDark ? colors.amber[400] : colors.amber[600]}
              style={{ verticalAlign: "middle", marginRight: 4 }}
            />
            {warning}
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, minHeight: "32px" }} />
      {children}
    </Box>
  );
};
