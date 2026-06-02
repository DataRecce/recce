"use client";

/**
 * @file UnitTestsView.tsx
 * @description DRC-3087 — flat-table "Unit Tests" section for the NodeView sidebar.
 *
 * Mirrors the schema-diff table conventions: each test shows a +/-/~ diff badge
 * (reusing the schema-change-badge classes) and its current pass/fail status.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { NodeUnitTest, NodeUnitTestSummary } from "../../api/info";

export interface UnitTestsViewProps {
  unitTests: NodeUnitTest[];
  summary?: NodeUnitTestSummary;
}

// Mirrors the schema-diff +/-/~ markers (matching their fg/bg intent) without
// pulling in the schema stylesheet.
const DIFF_BADGE: Record<
  NodeUnitTest["diff_status"],
  { symbol: string; color: string; bg: string; label: string } | null
> = {
  added: {
    symbol: "+",
    color: "#1b5e20",
    bg: "rgba(46,125,50,0.16)",
    label: "Added test",
  },
  removed: {
    symbol: "-",
    color: "#616161",
    bg: "rgba(97,97,97,0.16)",
    label: "Removed test",
  },
  changed: {
    symbol: "~",
    color: "#8a5a00",
    bg: "rgba(237,108,2,0.16)",
    label: "Changed test",
  },
  unchanged: null,
};

function StatusPill({ status }: { status: NodeUnitTest["status"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pass: { label: "Pass", color: "#1b5e20", bg: "rgba(46,125,50,0.14)" },
    fail: { label: "Fail", color: "#b71c1c", bg: "rgba(198,40,40,0.14)" },
    error: { label: "Error", color: "#b71c1c", bg: "rgba(198,40,40,0.14)" },
    skipped: { label: "Skipped", color: "#616161", bg: "rgba(97,97,97,0.14)" },
  };
  // No status (e.g. a removed test no longer runs).
  if (!status) {
    return (
      <Typography
        component="span"
        sx={{ color: "text.disabled", fontSize: "0.8rem" }}
      >
        —
      </Typography>
    );
  }
  const s = map[status];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: "8px",
        py: "2px",
        borderRadius: "10px",
        fontSize: "0.72rem",
        fontWeight: 700,
        color: s.color,
        backgroundColor: s.bg,
      }}
    >
      {s.label}
    </Box>
  );
}

export function UnitTestsView({ unitTests, summary }: UnitTestsViewProps) {
  if (unitTests.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          No unit tests defined for this model.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1.5 }}>
      {summary && (
        <Typography
          variant="body2"
          sx={{ mb: 1, fontWeight: 600, color: "text.secondary" }}
        >
          {summary.passed}/{summary.total} passing ({summary.pct}%)
        </Typography>
      )}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          columnGap: 1,
          rowGap: 0.5,
        }}
      >
        {unitTests.map((test) => {
          const badge = DIFF_BADGE[test.diff_status];
          const isRemoved = test.diff_status === "removed";
          return (
            <Box
              key={test.unique_id}
              sx={{ display: "contents" }}
              title={badge ? badge.label : undefined}
            >
              {/* +/-/~ badge (or a spacer to keep names aligned) */}
              {badge ? (
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    height: 16,
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: badge.color,
                    backgroundColor: badge.bg,
                  }}
                >
                  {badge.symbol}
                </Box>
              ) : (
                <Box sx={{ width: 16, height: 16 }} />
              )}
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: isRemoved ? "text.disabled" : "text.primary",
                  textDecoration: isRemoved ? "line-through" : "none",
                }}
              >
                {test.name}
              </Typography>
              <StatusPill status={test.status} />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
