"use client";

/**
 * @file LineageIndexSection.tsx
 * @description Collapsible "Upstream & Downstream" section shown at the top
 * of the Model Detail panel. Replaces the separate "index panel" idea by
 * folding direct upstream/downstream navigation into the existing panel.
 *
 * See design in docs/plans/lineage-view-index-panel-v2 (handoff from
 * Claude Design). Improvements over the initial V2 design:
 *  - per-column filter input when the list exceeds ~8 rows
 *  - 200px scroll cap so the section never dominates the panel
 *  - paginated "show N more" instead of "show all"
 */

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
import {
  MdArrowDownward,
  MdArrowUpward,
  MdChevronRight,
  MdSearch,
} from "react-icons/md";
import type { LineageGraphNode } from "../../contexts/lineage/types";
import { changeStatusColors } from "./styles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rows after which the column shows a filter input and caps its scroll. */
const FILTER_THRESHOLD = 8;
/** Initial number of rows shown per column. */
const INITIAL_PAGE_SIZE = 8;
/** Additional rows loaded on each "show N more" click. */
const PAGE_STEP = 20;
/** Hard cap on column height so the section never dominates the panel. */
const SCROLL_CAP_PX = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LineageIndexSectionProps {
  /** The focused node whose upstream/downstream to display. */
  node: LineageGraphNode;
  /**
   * Lookup of all nodes in the graph. Used to resolve parent/child ids to
   * display names and change statuses.
   */
  nodesById?: Record<string, LineageGraphNode>;
  /**
   * Called when a row is clicked. The consumer should refocus the panel and
   * re-center the lineage canvas on the given node id.
   */
  onNavigate?: (nodeId: string) => void;
  /** Optional initial expanded state. Defaults to true. */
  defaultExpanded?: boolean;
}

type Direction = "up" | "down";

interface ResolvedItem {
  id: string;
  name: string;
  changeStatus: "added" | "removed" | "modified" | "unchanged";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveItems(
  ids: string[],
  nodesById: Record<string, LineageGraphNode> | undefined,
): ResolvedItem[] {
  return ids.map((id) => {
    const n = nodesById?.[id];
    return {
      id,
      name: n?.data.name ?? id,
      changeStatus: n?.data.changeStatus ?? "unchanged",
    };
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusStrip({ status }: { status: ResolvedItem["changeStatus"] }) {
  return (
    <Box
      component="span"
      sx={{
        width: "3px",
        height: "14px",
        flex: "0 0 auto",
        borderRadius: "2px",
        backgroundColor: changeStatusColors[status],
      }}
    />
  );
}

interface MiniRowProps {
  item: ResolvedItem;
  onClick?: () => void;
}

function MiniRow({ item, onClick }: MiniRowProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        cursor: onClick ? "pointer" : "default",
        fontSize: "11.5px",
        fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
        lineHeight: 1.3,
        color: "text.primary",
        minWidth: 0,
        "&:hover": onClick
          ? {
              backgroundColor: "action.hover",
            }
          : undefined,
      }}
    >
      <StatusStrip status={item.changeStatus} />
      <Box
        component="span"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          flex: 1,
        }}
        title={item.name}
      >
        {item.name}
      </Box>
    </Box>
  );
}

interface DirectionColumnProps {
  direction: Direction;
  items: ResolvedItem[];
  onNavigate?: (nodeId: string) => void;
}

function DirectionColumn({
  direction,
  items,
  onNavigate,
}: DirectionColumnProps) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, query]);

  const visible = filtered.slice(0, visibleCount);
  const hidden = filtered.length - visible.length;
  const showFilter = items.length > FILTER_THRESHOLD;
  const isUp = direction === "up";
  const title = isUp ? "Upstream" : "Downstream";
  const emptyLabel = isUp ? "no upstream" : "leaf";
  const ArrowIcon = isUp ? MdArrowUpward : MdArrowDownward;

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRight: isUp ? "1px solid" : "none",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
      }}
      data-testid={`lineage-index-col-${direction}`}
    >
      {/* Column header */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          px: 1.25,
          py: 0.75,
          fontSize: "10px",
          fontWeight: 600,
          color: "text.secondary",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          backgroundColor: "grey.50",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <ArrowIcon size={11} />
        <span>{title}</span>
        <Box
          component="span"
          sx={{ color: "text.disabled", fontWeight: 500, ml: 0.5 }}
        >
          ({items.length})
        </Box>
      </Stack>

      {/* Filter input */}
      {showFilter && (
        <Box
          sx={{
            px: 1,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "4px",
              px: 0.75,
              py: 0.25,
              backgroundColor: "background.paper",
            }}
          >
            <MdSearch size={12} color="currentColor" opacity={0.55} />
            <InputBase
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
              placeholder="filter…"
              inputProps={{
                "aria-label": `Filter ${title}`,
                style: {
                  padding: 0,
                  fontSize: "10.5px",
                  fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
                },
              }}
              sx={{ flex: 1, fontSize: "10.5px" }}
            />
          </Stack>
        </Box>
      )}

      {/* Rows */}
      {filtered.length === 0 ? (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            fontSize: "10.5px",
            color: "text.disabled",
            fontStyle: "italic",
          }}
        >
          {query ? "no matches" : emptyLabel}
        </Box>
      ) : (
        <Box
          sx={{
            maxHeight: `${SCROLL_CAP_PX}px`,
            overflowY: "auto",
            py: 0.5,
          }}
        >
          {visible.map((item) => (
            <MiniRow
              key={item.id}
              item={item}
              onClick={onNavigate ? () => onNavigate(item.id) : undefined}
            />
          ))}
        </Box>
      )}

      {/* "show N more" */}
      {hidden > 0 && (
        <Box
          onClick={() =>
            setVisibleCount((n) => Math.min(filtered.length, n + PAGE_STEP))
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setVisibleCount((n) => Math.min(filtered.length, n + PAGE_STEP));
            }
          }}
          sx={{
            px: 1.5,
            py: 0.75,
            fontSize: "10.5px",
            color: "info.main",
            cursor: "pointer",
            borderTop: "1px solid",
            borderColor: "divider",
            userSelect: "none",
            "&:hover": { backgroundColor: "action.hover" },
          }}
        >
          + show {Math.min(PAGE_STEP, hidden)} more{" "}
          <Box component="span" sx={{ color: "text.disabled", ml: 0.5 }}>
            ({hidden} hidden)
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LineageIndexSection({
  node,
  nodesById,
  onNavigate,
  defaultExpanded = true,
}: LineageIndexSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const parentIds = useMemo(
    () => Object.keys(node.data.parents ?? {}),
    [node.data.parents],
  );
  const childIds = useMemo(
    () => Object.keys(node.data.children ?? {}),
    [node.data.children],
  );
  const upstream = useMemo(
    () => resolveItems(parentIds, nodesById),
    [parentIds, nodesById],
  );
  const downstream = useMemo(
    () => resolveItems(childIds, nodesById),
    [childIds, nodesById],
  );

  // If neither direction has entries, render nothing so the panel stays tight.
  if (upstream.length === 0 && downstream.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
      data-testid="lineage-index-section"
    >
      {/* Collapsible header */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.75}
        onClick={() => setExpanded((e) => !e)}
        sx={{
          px: 1.5,
          py: 1,
          cursor: "pointer",
          userSelect: "none",
          "&:hover": { backgroundColor: "action.hover" },
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls="lineage-index-body"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <IconButton
          size="small"
          disableRipple
          sx={{
            p: 0,
            color: "text.secondary",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms",
          }}
          tabIndex={-1}
          aria-hidden
        >
          <MdChevronRight size={14} />
        </IconButton>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
        >
          Upstream & Downstream
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ fontSize: "11px", color: "text.secondary" }}
        >
          <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
          >
            <MdArrowUpward size={10} />
            {upstream.length}
          </Box>
          <Box
            component="span"
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.25 }}
          >
            <MdArrowDownward size={10} />
            {downstream.length}
          </Box>
        </Stack>
      </Stack>

      {/* Body */}
      {expanded && (
        <Box
          id="lineage-index-body"
          sx={{
            display: "flex",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <DirectionColumn
            direction="up"
            items={upstream}
            onNavigate={onNavigate}
          />
          <DirectionColumn
            direction="down"
            items={downstream}
            onNavigate={onNavigate}
          />
        </Box>
      )}
    </Box>
  );
}
