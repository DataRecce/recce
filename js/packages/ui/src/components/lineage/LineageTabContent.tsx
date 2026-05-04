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
 *
 * Impact marks: when the focused node and a neighbor are both in the impact
 * set, the row gets a yellow rail/tint/arrow (matching the canvas via
 * `cllChangeStatusColors.impacted`). Tooltip is "Impacts this model"
 * upstream / "Impacted by this model" downstream.
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
import { changeStatusColors, cllChangeStatusColors } from "./styles";

// ---------------------------------------------------------------------------
// Impact-mark visual tokens
// ---------------------------------------------------------------------------

// All impact visuals derive from cllChangeStatusColors.impacted, the same
// color used by the canvas impacted node border / "!" badge. Chip palette
// mirrors --schema-badge-impacted-* in schema/style.css's .cll-experience
// block. The active-filter state uses a deeper amber so white text stays
// legible (yellow + white would fail contrast).
const IMPACT_ACCENT = cllChangeStatusColors.impacted; // rgb(252 211 77)
const IMPACT_TINT_LIGHT = "rgb(252 211 77 / 0.18)";
const IMPACT_TINT_DARK = "rgb(252 211 77 / 0.10)";
const IMPACT_CHIP_BG_LIGHT = "rgb(252 211 77 / 0.35)";
const IMPACT_CHIP_BG_DARK = "rgb(180 83 9 / 0.25)";
const IMPACT_CHIP_FG_LIGHT = "rgb(146 64 14)";
const IMPACT_CHIP_FG_DARK = "rgb(252 211 77)";
const IMPACT_CHIP_ACTIVE_BG = "rgb(180 83 9)";

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
  /**
   * Nodes that propagate impact downward (own breaking/partial_breaking change,
   * added/removed, or receive upstream impact). Drives upstream rail marks.
   */
  impactingNodeIds?: Set<string>;
  /** Nodes with CLL `impacted = true`. Drives downstream rail marks. */
  impactedNodeIds?: Set<string>;
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

/** Unchanged-but-impacted nodes use the impacted color, matching the canvas. */
function getNodeStatusColor(
  status: ChangeStatus,
  cllImpacted: boolean | undefined,
): string {
  if (status === "unchanged" && cllImpacted) {
    return cllChangeStatusColors.impacted;
  }
  return changeStatusColors[status];
}

function StatusDot({
  status,
  cllImpacted,
}: {
  status: ChangeStatus;
  /** When true, color the dot as impacted (matches canvas). */
  cllImpacted?: boolean;
}) {
  const effectiveStatus =
    status === "unchanged" && cllImpacted ? "impacted" : status;
  return (
    <Box
      component="span"
      data-testid="lineage-status-dot"
      data-status={effectiveStatus}
      sx={{
        width: "8px",
        height: "8px",
        borderRadius: "2px",
        backgroundColor: getNodeStatusColor(status, cllImpacted),
        flex: "0 0 auto",
      }}
    />
  );
}

interface DirectRowProps {
  name: string;
  status: ChangeStatus;
  direction: Direction;
  /** When true, decorate the row with the impact mark (rail + tint + arrow). */
  impacted?: boolean;
  /** Carries CLL `impacted = true` — drives the dot color, independent of
   *  `impacted` above (which drives row decoration). */
  cllImpacted?: boolean;
  onClick?: () => void;
}

function DirectRow({
  name,
  status,
  direction,
  impacted,
  cllImpacted,
  onClick,
}: DirectRowProps) {
  const { isDark } = useThemeColors();
  const tooltip =
    direction === "up" ? "Impacts this model" : "Impacted by this model";
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
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
        backgroundColor: impacted
          ? isDark
            ? IMPACT_TINT_DARK
            : IMPACT_TINT_LIGHT
          : undefined,
        "&:hover": onClick ? { backgroundColor: "action.hover" } : undefined,
      }}
    >
      {impacted && (
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "3px",
            backgroundColor: IMPACT_ACCENT,
          }}
        />
      )}
      <StatusDot status={status} cllImpacted={cllImpacted} />
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
      {impacted && (
        <Tooltip title={tooltip} placement="top" arrow>
          <Box
            component="span"
            aria-label={tooltip}
            data-testid="lineage-impact-mark"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
              color: IMPACT_ACCENT,
              flex: "0 0 auto",
            }}
          >
            <MdArrowDownward size={12} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}

function SectionHeader({
  direction,
  directCount,
  impactCount,
  onlyImpact,
  onToggleOnlyImpact,
}: {
  direction: Direction;
  directCount: number;
  /** Number of direct neighbors on this side that are part of the impact chain. */
  impactCount?: number;
  /** Current state of the per-side "only impact" filter toggle. */
  onlyImpact?: boolean;
  /** When provided and impactCount > 0, the chip becomes a filter toggle. */
  onToggleOnlyImpact?: () => void;
}) {
  const isUp = direction === "up";
  const ArrowIcon = isUp ? MdArrowUpward : MdArrowDownward;
  const { isDark, background } = useThemeColors();
  const showChip = (impactCount ?? 0) > 0;
  const chipInteractive = !!onToggleOnlyImpact;
  const chipLabel = isUp
    ? `${impactCount} impacting`
    : `${impactCount} impacted`;
  const chipTitle = chipInteractive
    ? onlyImpact
      ? "Show all models"
      : isUp
        ? "Show only impacting models"
        : "Show only impacted models"
    : undefined;
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
      {showChip && (
        <Tooltip title={chipTitle ?? ""} placement="top" arrow>
          <Box
            component={chipInteractive ? "button" : "span"}
            type={chipInteractive ? "button" : undefined}
            data-testid="lineage-impact-chip"
            aria-pressed={chipInteractive ? onlyImpact : undefined}
            aria-label={chipTitle ?? chipLabel}
            onClick={onToggleOnlyImpact}
            sx={{
              ml: 0.75,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              px: "7px",
              py: "1px",
              borderRadius: "999px",
              backgroundColor: onlyImpact
                ? IMPACT_CHIP_ACTIVE_BG
                : isDark
                  ? IMPACT_CHIP_BG_DARK
                  : IMPACT_CHIP_BG_LIGHT,
              color: onlyImpact
                ? "#fff"
                : isDark
                  ? IMPACT_CHIP_FG_DARK
                  : IMPACT_CHIP_FG_LIGHT,
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.02em",
              border: "none",
              font: "inherit",
              cursor: chipInteractive ? "pointer" : "default",
              "&:hover": chipInteractive
                ? {
                    filter: onlyImpact
                      ? "brightness(0.95)"
                      : "brightness(0.97)",
                  }
                : undefined,
            }}
          >
            <Box
              component="span"
              aria-hidden="true"
              sx={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                backgroundColor: onlyImpact
                  ? "#fff"
                  : isDark
                    ? IMPACT_CHIP_FG_DARK
                    : IMPACT_CHIP_FG_LIGHT,
              }}
            />
            {chipLabel}
          </Box>
        </Tooltip>
      )}
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
  cllImpacted,
}: {
  node: LineageGraphNode;
  onCenterFocus?: () => void;
  /** Drives the impacted accent on unchanged-but-impacted focus. */
  cllImpacted?: boolean;
}) {
  const status = getChangeStatus(node);
  const { isDark, background } = useThemeColors();
  const accentColor = getNodeStatusColor(status, cllImpacted);
  const statusLabel =
    status === "unchanged" && cllImpacted ? "impacted" : status;
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
          backgroundColor: accentColor,
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
          color: accentColor,
          backgroundColor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          textTransform: "capitalize",
          flex: "0 0 auto",
        }}
      >
        {statusLabel}
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
  const { isDark } = useThemeColors();
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
          textDecorationColor: isDark
            ? "rgb(255 255 255 / 0.35)"
            : "rgb(0 0 0 / 0.25)",
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
  impactingNodeIds,
  impactedNodeIds,
}: LineageTabContentProps) {
  const { background } = useThemeColors();

  // Per-side filter + pagination state.
  const [queryUp, setQueryUp] = useState("");
  const [queryDown, setQueryDown] = useState("");
  const [visibleUp, setVisibleUp] = useState(INITIAL_PAGE_SIZE);
  const [visibleDown, setVisibleDown] = useState(INITIAL_PAGE_SIZE);
  // Per-side "only show impact" toggle, driven by the header chip.
  const [onlyImpactUp, setOnlyImpactUp] = useState(false);
  const [onlyImpactDown, setOnlyImpactDown] = useState(false);

  // Reset state when the focused node changes. node.id is intentionally
  // the trigger — the effect doesn't *use* it, only watches it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: node.id is the trigger, not a value used inside.
  useEffect(() => {
    setQueryUp("");
    setQueryDown("");
    setVisibleUp(INITIAL_PAGE_SIZE);
    setVisibleDown(INITIAL_PAGE_SIZE);
    setOnlyImpactUp(false);
    setOnlyImpactDown(false);
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

  // Skip marks if the focus isn't itself in the impact chain — it has no
  // neighbors to "impact" or "be impacted by".
  const impactActive =
    (impactingNodeIds?.size ?? 0) > 0 || (impactedNodeIds?.size ?? 0) > 0;
  const focusInImpact =
    impactActive &&
    ((impactingNodeIds?.has(node.id) ?? false) ||
      (impactedNodeIds?.has(node.id) ?? false));

  const isImpactedNeighbor = (neighborId: string, dir: Direction): boolean => {
    if (!focusInImpact) return false;
    const set = dir === "up" ? impactingNodeIds : impactedNodeIds;
    return set?.has(neighborId) ?? false;
  };

  const upImpactCount = focusInImpact
    ? parentIds.filter((id) => impactingNodeIds?.has(id)).length
    : 0;
  const downImpactCount = focusInImpact
    ? childIds.filter((id) => impactedNodeIds?.has(id)).length
    : 0;

  const renderDirection = (direction: Direction) => {
    const isUp = direction === "up";
    const allDirect = isUp ? parentIds : childIds;
    const baseFiltered = isUp ? filteredParentIds : filteredChildIds;
    const onlyImpact = isUp ? onlyImpactUp : onlyImpactDown;
    const filtered = onlyImpact
      ? baseFiltered.filter((id) => isImpactedNeighbor(id, direction))
      : baseFiltered;
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
              direction={direction}
              impacted={isImpactedNeighbor(id, direction)}
              cllImpacted={impactedNodeIds?.has(id) ?? false}
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
        <SectionHeader
          direction="up"
          directCount={parentIds.length}
          impactCount={upImpactCount}
          onlyImpact={onlyImpactUp}
          onToggleOnlyImpact={() => {
            setOnlyImpactUp((v) => !v);
            setVisibleUp(INITIAL_PAGE_SIZE);
          }}
        />
        {renderDirection("up")}

        <FocusCard
          node={node}
          onCenterFocus={onCenterFocus}
          cllImpacted={impactedNodeIds?.has(node.id) ?? false}
        />

        <SectionHeader
          direction="down"
          directCount={childIds.length}
          impactCount={downImpactCount}
          onlyImpact={onlyImpactDown}
          onToggleOnlyImpact={() => {
            setOnlyImpactDown((v) => !v);
            setVisibleDown(INITIAL_PAGE_SIZE);
          }}
        />
        {renderDirection("down")}
      </Box>
    </Box>
  );
}
