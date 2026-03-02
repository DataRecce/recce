"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { memo } from "react";

/**
 * Single legend entry
 */
export interface ChartLegendItem {
  /** Color swatch */
  color: string;
  /** Display label */
  label: string;
}

/**
 * Props for ChartLegend component
 */
export interface ChartLegendProps {
  /** Legend items to display */
  items: ChartLegendItem[];
  /** Optional CSS class */
  className?: string;
}

/**
 * Shared chart legend component with thick colored swatches.
 *
 * Used by TopKBarChart, HistogramChart, and other chart components
 * to provide a consistent legend appearance.
 *
 * @example
 * ```tsx
 * <ChartLegend
 *   items={[
 *     { color: "#F6AD55", label: "Base" },
 *     { color: "#63B3ED", label: "Current" },
 *   ]}
 * />
 * ```
 */
function ChartLegendComponent({ items, className }: ChartLegendProps) {
  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        justifyContent: "center",
        gap: 3,
        py: 1,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <Box
            sx={{
              width: 32,
              height: 12,
              bgcolor: item.color,
              borderRadius: "2px",
            }}
          />
          <Typography
            sx={{
              fontSize: "0.8125rem",
              color: "text.secondary",
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export const ChartLegend = memo(ChartLegendComponent);
ChartLegend.displayName = "ChartLegend";
