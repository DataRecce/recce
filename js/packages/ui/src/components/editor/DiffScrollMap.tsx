"use client";

import Box from "@mui/material/Box";
import { type PointerEvent, useCallback } from "react";

export type MarkType = "added" | "deleted" | "modified";

export interface ScrollMapMark {
  topPercent: number;
  heightPercent: number;
  type: MarkType;
}

interface DiffScrollMapProps {
  marks: ScrollMapMark[];
  isDark?: boolean;
  onMarkClick?: (topPercent: number) => void;
}

const COLORS_LIGHT: Record<MarkType, string> = {
  added: "#4caf50",
  deleted: "#f44336",
  modified: "#ffc107",
};

const COLORS_DARK: Record<MarkType, string> = {
  added: "#66bb6a",
  deleted: "#ef5350",
  modified: "#ffca28",
};

const OPACITY_DEFAULT = 0.8;
const OPACITY_HOVER = 1.0;

function handlePointerEnter(e: PointerEvent<HTMLButtonElement>) {
  e.currentTarget.style.opacity = String(OPACITY_HOVER);
}

function handlePointerLeave(e: PointerEvent<HTMLButtonElement>) {
  e.currentTarget.style.opacity = String(OPACITY_DEFAULT);
}

export function DiffScrollMap({
  marks,
  isDark = false,
  onMarkClick,
}: DiffScrollMapProps) {
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const handleClick = useCallback(
    (topPercent: number) => {
      onMarkClick?.(topPercent);
    },
    [onMarkClick],
  );

  return (
    <Box
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "6px",
        height: "100%",
        zIndex: 1,
      }}
    >
      {marks.map((mark, index) => (
        <button
          key={`${mark.type}-${mark.topPercent}-${index}`}
          type="button"
          aria-label={`${mark.type} change at ${Math.round(mark.topPercent)}%`}
          onClick={() => handleClick(mark.topPercent)}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          style={{
            position: "absolute",
            top: `${mark.topPercent}%`,
            height: `${mark.heightPercent}%`,
            minHeight: "2px",
            width: "100%",
            backgroundColor: colors[mark.type],
            border: "none",
            padding: 0,
            cursor: "pointer",
            opacity: OPACITY_DEFAULT,
          }}
        />
      ))}
    </Box>
  );
}
