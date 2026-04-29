"use client";

/**
 * @file LineageTabContent.tsx
 * @description "Lineage" tab inside the Model Detail panel — shows direct
 * upstream parents and direct downstream children for the focused node.
 *
 * Layout (top → bottom):
 *  - Toolbar: back button + breadcrumb path of visited nodes + center-on-canvas
 *  - UPSTREAM section: direct parents (filterable / paginated)
 *  - Focused-node card (orange accent)
 *  - DOWNSTREAM section: direct children (filterable / paginated)
 */

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useMemo, useState } from "react";
import {
  MdArrowBack,
  MdArrowDownward,
  MdArrowUpward,
  MdGpsFixed,
  MdSearch,
} from "react-icons/md";
import type { LineageGraphNode } from "../../contexts/lineage/types";
import { useThemeColors } from "../../hooks";
import { changeStatusColors } from "./styles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rows after which the side shows a filter input. */
const FILTER_THRESHOLD = 8;
/** Initial number of direct rows shown per side. */
const INITIAL_PAGE_SIZE = 8;
/** Additional rows revealed per "show N more" click. */
const PAGE_STEP = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = "up" | "down";
type ChangeStatus = "added" | "removed" | "modified" | "unchanged";

export interface LineageTabContentProps {
  node: LineageGraphNode;
  /** Lookup of all nodes in the graph for resolving parent/child ids. */
  nodesById?: Record<string, LineageGraphNode>;
  /** Refocus the panel to a different node. */
  onNavigate?: (nodeId: string) => void;
  /** Return to the previously focused node. Hidden when undefined. */
  onBack?: () => void;
  /** Pan/zoom the canvas onto the currently focused node. */
  onCenterFocus?: () => void;
  /** Stack of previously focused node ids, oldest first. */
  historyTrail?: string[];
  /** Jump to an entry in the history (breadcrumb click). */
  onJumpToHistory?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getChangeStatus(node: LineageGraphNode | undefined): ChangeStatus {
  return node?.data.changeStatus ?? "unchanged";
}

function getDisplayName(
  id: string,
  nodesById: Record<string, LineageGraphNode> | undefined,
): string {
  return nodesById?.[id]?.data.name ?? id;
}

/** Case-insensitive filter on display name. Empty query returns input unchanged. */
function filterIds(
  ids: string[],
  query: string,
  nodesById: Record<string, LineageGraphNode> | undefined,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return ids;
  return ids.filter((id) =>
    getDisplayName(id, nodesById).toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: ChangeStatus }) {
  return (
    <Box
      component="span"
      sx={{
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        backgroundColor: changeStatusColors[status],
        flex: "0 0 auto",
      }}
    />
  );
}

interface DirectRowProps {
  name: string;
  status: ChangeStatus;
  onClick?: () => void;
}

function DirectRow({ name, status, onClick }: DirectRowProps) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        pl: 1.5,
        pr: 1.25,
        py: 0.5,
        cursor: onClick ? "pointer" : "default",
        fontSize: "12px",
        fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
        lineHeight: 1.3,
        color: "text.primary",
        minWidth: 0,
        "&:hover": onClick ? { backgroundColor: "action.hover" } : undefined,
      }}
    >
      <StatusDot status={status} />
      <Box
        component="span"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          flex: 1,
        }}
        title={name}
      >
        {name}
      </Box>
    </Box>
  );
}

function SectionHeader({
  direction,
  directCount,
}: {
  direction: Direction;
  directCount: number;
}) {
  const isUp = direction === "up";
  const ArrowIcon = isUp ? MdArrowUpward : MdArrowDownward;
  const { background } = useThemeColors();
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        px: 1.5,
        py: 0.875,
        backgroundColor: background.subtle,
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        fontSize: "11px",
        color: "text.secondary",
        fontWeight: 600,
      }}
    >
      <ArrowIcon size={11} />
      <Box
        component="span"
        sx={{ textTransform: "uppercase", letterSpacing: "0.06em" }}
      >
        {isUp ? "Upstream" : "Downstream"}
      </Box>
      <Box component="span" sx={{ color: "text.disabled", fontWeight: 500 }}>
        · {directCount} direct
      </Box>
    </Stack>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        fontSize: "11px",
        color: "text.disabled",
        fontStyle: "italic",
      }}
    >
      {label}
    </Box>
  );
}

interface FilterInputProps {
  direction: Direction;
  query: string;
  onChange: (next: string) => void;
}

function FilterInput({ direction, query, onChange }: FilterInputProps) {
  const label = direction === "up" ? "Upstream" : "Downstream";
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.75,
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          alignItems: "center",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "4px",
          px: 0.875,
          py: 0.25,
        }}
      >
        <MdSearch size={12} color="currentColor" opacity={0.55} />
        <InputBase
          value={query}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder="filter…"
          inputProps={{
            "aria-label": `Filter ${label}`,
            style: {
              padding: 0,
              fontSize: "11px",
              fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
            },
          }}
          sx={{ flex: 1, fontSize: "11px" }}
        />
      </Stack>
    </Box>
  );
}

interface ShowMoreRowProps {
  hidden: number;
  onClick: () => void;
}

function ShowMoreRow({ hidden, onClick }: ShowMoreRowProps) {
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        px: 1.5,
        py: 0.75,
        fontSize: "11px",
        color: "info.main",
        cursor: "pointer",
        userSelect: "none",
        "&:hover": { backgroundColor: "action.hover" },
      }}
    >
      + show {Math.min(PAGE_STEP, hidden)} more{" "}
      <Box component="span" sx={{ color: "text.disabled", ml: 0.5 }}>
        ({hidden} hidden)
      </Box>
    </Box>
  );
}

function FocusCard({
  node,
  onCenterFocus,
}: {
  node: LineageGraphNode;
  onCenterFocus?: () => void;
}) {
  const status = getChangeStatus(node);
  const { isDark, background } = useThemeColors();
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        px: 1.5,
        py: 1.25,
        backgroundColor: isDark ? background.emphasized : "rgb(255 245 241)",
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box
        component="span"
        sx={{
          width: "4px",
          height: "26px",
          borderRadius: "2px",
          backgroundColor: changeStatusColors[status],
          flex: "0 0 auto",
        }}
      />
      <Box
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
          fontSize: "13px",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={node.data.name}
      >
        {node.data.name}
      </Box>
      {onCenterFocus && (
        <Tooltip title="Center on canvas" placement="top">
          <IconButton
            size="small"
            aria-label="Center on canvas"
            onClick={onCenterFocus}
            sx={{ p: 0.5, color: "text.secondary", flex: "0 0 auto" }}
          >
            <MdGpsFixed size={14} />
          </IconButton>
        </Tooltip>
      )}
      <Box
        component="span"
        sx={{
          fontSize: "10px",
          fontWeight: 600,
          px: 0.875,
          py: "2px",
          borderRadius: "3px",
          color: changeStatusColors[status],
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          textTransform: "capitalize",
          flex: "0 0 auto",
        }}
      >
        {status}
      </Box>
    </Stack>
  );
}

interface PathBreadcrumbProps {
  /** Display name of the most recent previously focused node. */
  previousName: string;
  /** Display name of the currently focused node. */
  currentName: string;
  /** Click the previous-step name to jump back. */
  onJumpBack?: () => void;
}

function PathBreadcrumb({
  previousName,
  currentName,
  onJumpBack,
}: PathBreadcrumbProps) {
  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{
        alignItems: "center",
        minWidth: 0,
        flex: 1,
        overflow: "hidden",
        fontFamily: "ui-monospace, 'IBM Plex Mono', monospace",
        fontSize: "12px",
      }}
    >
      <Box
        component="span"
        sx={{
          color: "text.secondary",
          fontFamily: "inherit",
          flex: "0 0 auto",
        }}
      >
        Path
      </Box>
      <Box
        component="span"
        role={onJumpBack ? "button" : undefined}
        tabIndex={onJumpBack ? 0 : undefined}
        onClick={onJumpBack}
        onKeyDown={
          onJumpBack
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onJumpBack();
                }
              }
            : undefined
        }
        sx={{
          color: "text.primary",
          cursor: onJumpBack ? "pointer" : "default",
          textDecoration: "underline",
          textDecorationColor: "rgb(0 0 0 / 0.25)",
          textUnderlineOffset: "2px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          "&:hover": onJumpBack
            ? { textDecorationColor: "currentColor" }
            : undefined,
        }}
        title={previousName}
      >
        {previousName}
      </Box>
      <Box
        component="span"
        aria-hidden="true"
        sx={{ color: "text.disabled", flex: "0 0 auto" }}
      >
        ›
      </Box>
      <Box
        component="span"
        sx={{
          color: "primary.main",
          fontWeight: 700,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
        title={currentName}
      >
        {currentName}
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LineageTabContent({
  node,
  nodesById,
  onNavigate,
  onBack,
  onCenterFocus,
  historyTrail,
  onJumpToHistory,
}: LineageTabContentProps) {
  const { background } = useThemeColors();

  // Per-side filter + pagination state.
  const [queryUp, setQueryUp] = useState("");
  const [queryDown, setQueryDown] = useState("");
  const [visibleUp, setVisibleUp] = useState(INITIAL_PAGE_SIZE);
  const [visibleDown, setVisibleDown] = useState(INITIAL_PAGE_SIZE);

  // Reset state when the focused node changes. node.id is intentionally
  // the trigger — the effect doesn't *use* it, only watches it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: node.id is the trigger, not a value used inside.
  useEffect(() => {
    setQueryUp("");
    setQueryDown("");
    setVisibleUp(INITIAL_PAGE_SIZE);
    setVisibleDown(INITIAL_PAGE_SIZE);
  }, [node.id]);

  const parentIds = useMemo(
    () => Object.keys(node.data.parents ?? {}),
    [node.data.parents],
  );
  const childIds = useMemo(
    () => Object.keys(node.data.children ?? {}),
    [node.data.children],
  );

  const filteredParentIds = useMemo(
    () => filterIds(parentIds, queryUp, nodesById),
    [parentIds, queryUp, nodesById],
  );
  const filteredChildIds = useMemo(
    () => filterIds(childIds, queryDown, nodesById),
    [childIds, queryDown, nodesById],
  );

  const renderDirection = (direction: Direction) => {
    const isUp = direction === "up";
    const allDirect = isUp ? parentIds : childIds;
    const filtered = isUp ? filteredParentIds : filteredChildIds;
    const query = isUp ? queryUp : queryDown;
    const setQuery = isUp ? setQueryUp : setQueryDown;
    const visible = isUp ? visibleUp : visibleDown;
    const setVisible = isUp ? setVisibleUp : setVisibleDown;
    const showFilter = allDirect.length > FILTER_THRESHOLD;
    const visibleIds = filtered.slice(0, visible);
    const hidden = filtered.length - visibleIds.length;
    const emptyLabel = isUp
      ? "(source — no upstream)"
      : "(leaf — no downstream)";

    return (
      <>
        {showFilter && (
          <FilterInput
            direction={direction}
            query={query}
            onChange={(next) => {
              setQuery(next);
              setVisible(INITIAL_PAGE_SIZE);
            }}
          />
        )}
        {allDirect.length === 0 ? (
          <EmptyRow label={emptyLabel} />
        ) : filtered.length === 0 ? (
          <EmptyRow label="no matches" />
        ) : (
          visibleIds.map((id) => (
            <DirectRow
              key={`${direction}-${id}`}
              name={getDisplayName(id, nodesById)}
              status={getChangeStatus(nodesById?.[id])}
              onClick={onNavigate ? () => onNavigate(id) : undefined}
            />
          ))
        )}
        {hidden > 0 && (
          <ShowMoreRow
            hidden={hidden}
            onClick={() =>
              setVisible((n) => Math.min(filtered.length, n + PAGE_STEP))
            }
          />
        )}
      </>
    );
  };

  const hasTrail = (historyTrail?.length ?? 0) > 0;
  const showToolbar = !!onBack || hasTrail;

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
      }}
      data-testid="lineage-tab-content"
    >
      {/* Toolbar: back + path breadcrumb + center */}
      {showToolbar && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            backgroundColor: background.subtle,
            minWidth: 0,
          }}
        >
          {onBack && (
            <Tooltip title="Back to previous node" placement="top">
              <IconButton
                size="small"
                aria-label="Back to previous node"
                onClick={onBack}
                sx={{
                  flex: "0 0 auto",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "6px",
                  px: 1,
                  py: 0.375,
                  color: "text.secondary",
                  backgroundColor: "background.paper",
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                <MdArrowBack size={14} />
              </IconButton>
            </Tooltip>
          )}
          {hasTrail && historyTrail ? (
            <PathBreadcrumb
              previousName={getDisplayName(
                historyTrail[historyTrail.length - 1],
                nodesById,
              )}
              currentName={node.data.name}
              onJumpBack={
                onJumpToHistory
                  ? () => onJumpToHistory(historyTrail.length - 1)
                  : onBack
              }
            />
          ) : (
            <Box sx={{ flex: 1 }} />
          )}
        </Stack>
      )}

      {/* Scrollable body */}
      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <SectionHeader direction="up" directCount={parentIds.length} />
        {renderDirection("up")}

        <FocusCard node={node} onCenterFocus={onCenterFocus} />

        <SectionHeader direction="down" directCount={childIds.length} />
        {renderDirection("down")}
      </Box>
    </Box>
  );
}
