import { HSplit } from "@datarecce/ui";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useTheme } from "@mui/material/styles";
import React, { ReactNode } from "react";

/**
 * Loading fallback - shows minimal UI while search params are being read
 */
export default function CheckPageLoading(): ReactNode {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const borderColor = isDark ? "grey.700" : "grey.300";

  return (
    <HSplit style={{ height: "100%" }} minSize={50} sizes={[20, 80]}>
      <Box
        sx={{
          borderRight: "1px solid",
          borderRightColor: borderColor,
          height: "100%",
        }}
        style={{ contain: "size" }}
      >
        <Box
          sx={{
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress size={20} />
        </Box>
      </Box>
      <Box>
        <Box
          sx={{
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CircularProgress size={20} />
        </Box>
      </Box>
    </HSplit>
  );
}
