"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode } from "react";
import { useIsDark } from "../../hooks/useIsDark";
import {
  formatRunDate,
  type RunStatus,
  RunStatusWithDate,
} from "./RunStatusBadge";

/**
 * Run data for list display
 */
export interface RunListItemData {
  /** Unique run ID */
  id: string;
  /** Run name */
  name?: string;
  /** Run type identifier */
  type: string;
  /** Run status */
  status: RunStatus;
  /** Run timestamp */
  runAt?: string;
  /** Associated check ID (if linked to a check) */
  checkId?: string;
}

/**
 * Props for a single run list item
 */
export interface RunListItemProps {
  /** Run data */
  run: RunListItemData;
  /** Whether this item is selected */
  isSelected?: boolean;
  /** Icon for the run type */
  icon?: ReactNode;
  /** Callback when item is clicked */
  onClick?: (runId: string) => void;
  /** Callback when "add to checklist" is clicked */
  onAddToChecklist?: (runId: string) => void;
  /** Callback when "go to check" is clicked */
  onGoToCheck?: (checkId: string) => void;
  /** Icon for "add to checklist" action */
  addToChecklistIcon?: ReactNode;
  /** Icon for "go to check" action */
  goToCheckIcon?: ReactNode;
  /** Hide add to checklist action */
  hideAddToChecklist?: boolean;
  /** Optional CSS class */
  className?: string;
}

/**
 * RunListItem Component
 *
 * A single item in a run list with selection state and actions.
 *
 * @example
 * ```tsx
 * <RunListItem
 *   run={run}
 *   isSelected={selectedRunId === run.id}
 *   icon={<QueryIcon />}
 *   onClick={(id) => setSelectedRunId(id)}
 *   onAddToChecklist={(id) => addRunToChecklist(id)}
 * />
 * ```
 */
function RunListItemComponent({
  run,
  isSelected = false,
  icon,
  onClick,
  onAddToChecklist,
  onGoToCheck,
  addToChecklistIcon,
  goToCheckIcon,
  hideAddToChecklist = false,
  className,
}: RunListItemProps) {
  const isDark = useIsDark();
  const hasCheckLink = run.checkId != null;
  const showAddToChecklist =
    !hideAddToChecklist && !hasCheckLink && onAddToChecklist;

  return (
    <Box
      className={className}
      onClick={() => onClick?.(run.id)}
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        width: "100%",
        p: "8px 16px",
        cursor: "pointer",
        borderBottom: 1,
        borderColor: "divider",
        borderLeft: "4px solid",
        borderLeftColor: isSelected ? "warning.main" : "transparent",
        bgcolor: isSelected
          ? isDark
            ? "warning.dark"
            : "warning.light"
          : "transparent",
        "&:hover": {
          bgcolor: isSelected
            ? isDark
              ? "warning.dark"
              : "warning.light"
            : theme.palette.action.hover,
        },
      })}
    >
      {/* Name and actions row */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        {icon && (
          <Box sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }}>
            {icon}
          </Box>
        )}
        <Typography
          sx={{
            flex: 1,
            fontSize: "0.875rem",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: run.name ? "text.primary" : "text.secondary",
          }}
        >
          {run.name?.trim() || "<no name>"}
        </Typography>

        {/* Check link or add to checklist */}
        {hasCheckLink && onGoToCheck && (
          <Tooltip title="Go to Check">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                if (run.checkId) onGoToCheck(run.checkId);
              }}
              sx={{ p: 0.5 }}
            >
              {goToCheckIcon || (
                <Box
                  component="span"
                  sx={{ fontSize: 14, color: "success.main" }}
                >
                  ✓
                </Box>
              )}
            </IconButton>
          </Tooltip>
        )}
        {showAddToChecklist && (
          <Tooltip title="Add to Checklist">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onAddToChecklist(run.id);
              }}
              sx={{ p: 0.5 }}
            >
              {addToChecklistIcon || (
                <Box component="span" sx={{ fontSize: 14 }}>
                  ○
                </Box>
              )}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Status and date row */}
      <RunStatusWithDate status={run.status} runAt={run.runAt} />
    </Box>
  );
}

export const RunListItem = memo(RunListItemComponent);
RunListItem.displayName = "RunListItem";

/**
 * Props for RunList component
 */
export interface RunListProps {
  /** List of runs to display */
  runs: RunListItemData[];
  /** Currently selected run ID */
  selectedId?: string | null;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Callback when a run is selected */
  onRunSelect?: (runId: string) => void;
  /** Callback when "add to checklist" is clicked */
  onAddToChecklist?: (runId: string) => void;
  /** Callback when "go to check" is clicked */
  onGoToCheck?: (checkId: string) => void;
  /** Function to get icon for run type */
  getRunIcon?: (runType: string) => ReactNode;
  /** Hide add to checklist action */
  hideAddToChecklist?: boolean;
  /** List title */
  title?: string;
  /** Header action buttons */
  headerActions?: ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state message */
  loadingMessage?: string;
  /** Group runs by date */
  groupByDate?: boolean;
  /** Icon for "add to checklist" action - passed to all list items */
  addToChecklistIcon?: ReactNode;
  /** Icon for "go to check" action - passed to all list items */
  goToCheckIcon?: ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * Date segment divider
 */
interface DateSegmentProps {
  date: string;
}

const DateSegment = memo(function DateSegment({ date }: DateSegmentProps) {
  return (
    <Box
      sx={{
        width: "100%",
        p: "8px 16px",
        borderBottom: 1,
        borderColor: "divider",
        color: "text.secondary",
        fontSize: "0.75rem",
        fontWeight: 500,
        bgcolor: "action.hover",
      }}
    >
      {date}
    </Box>
  );
});

/**
 * RunList Component
 *
 * A pure presentation component for displaying a list of runs with
 * selection, actions, and optional date grouping.
 *
 * @example Basic usage
 * ```tsx
 * import { RunList } from '@datarecce/ui/primitives';
 *
 * function HistoryPanel({ runs }) {
 *   const [selectedId, setSelectedId] = useState(null);
 *
 *   return (
 *     <RunList
 *       runs={runs}
 *       selectedId={selectedId}
 *       onRunSelect={setSelectedId}
 *       title="History"
 *       groupByDate
 *     />
 *   );
 * }
 * ```
 *
 * @example With custom icons
 * ```tsx
 * <RunList
 *   runs={runs}
 *   selectedId={selectedId}
 *   onRunSelect={setSelectedId}
 *   getRunIcon={(type) => {
 *     switch (type) {
 *       case 'query': return <SqlIcon />;
 *       case 'profile': return <ProfileIcon />;
 *       default: return <DefaultIcon />;
 *     }
 *   }}
 * />
 * ```
 */
function RunListComponent({
  runs,
  selectedId,
  isLoading = false,
  onRunSelect,
  onAddToChecklist,
  onGoToCheck,
  getRunIcon,
  hideAddToChecklist = false,
  title = "Runs",
  headerActions,
  emptyMessage = "No runs",
  loadingMessage = "Loading...",
  groupByDate = false,
  addToChecklistIcon,
  goToCheckIcon,
  className,
}: RunListProps) {
  // Group runs by date if needed
  const renderRuns = () => {
    if (runs.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            color: "text.secondary",
            p: 4,
          }}
        >
          {emptyMessage}
        </Box>
      );
    }

    let previousDate: string | null = null;
    return runs.map((run) => {
      const currentDate = run.runAt ? formatRunDate(new Date(run.runAt)) : null;
      const showDateSegment =
        groupByDate && currentDate && previousDate !== currentDate;
      previousDate = currentDate;

      return (
        <Box key={run.id}>
          {showDateSegment && <DateSegment date={currentDate} />}
          <RunListItem
            run={run}
            isSelected={run.id === selectedId}
            icon={getRunIcon?.(run.type)}
            onClick={onRunSelect}
            onAddToChecklist={onAddToChecklist}
            onGoToCheck={onGoToCheck}
            hideAddToChecklist={hideAddToChecklist}
            addToChecklistIcon={addToChecklistIcon}
            goToCheckIcon={goToCheckIcon}
          />
        </Box>
      );
    });
  };

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          flex: "0 0 auto",
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {headerActions}
      </Stack>

      {/* List content */}
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
        }}
      >
        {isLoading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "text.secondary",
            }}
          >
            {loadingMessage}
          </Box>
        ) : (
          renderRuns()
        )}
      </Box>
    </Box>
  );
}

export const RunList = memo(RunListComponent);
RunList.displayName = "RunList";
