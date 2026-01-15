"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { memo, useCallback, useMemo } from "react";
import type { Check } from "../../providers/contexts/CheckContext";
import { useCheckContext } from "../../providers/contexts/CheckContext";
import type { CheckAction, CheckActionType } from "../check/CheckActions";
import type { CheckCardData } from "../check/CheckCard";
import {
  CheckDetail,
  type CheckDetailProps,
  type CheckDetailTab,
} from "../check/CheckDetail";
import { CheckEmptyState } from "../check/CheckEmptyState";
import { CheckList } from "../check/CheckList";
import { SplitPane } from "../ui/SplitPane";

/**
 * Props for the ChecksView component.
 * Defines options for viewing and managing checks.
 */
export interface ChecksViewProps {
  /**
   * Optional checks data. If not provided, uses CheckContext.
   */
  checks?: Check[];

  /**
   * Loading state. If not provided, uses CheckContext.
   */
  isLoading?: boolean;

  /**
   * Error message. If not provided, uses CheckContext.
   */
  error?: string;

  /**
   * Currently selected check ID. If not provided, uses CheckContext.
   */
  selectedCheckId?: string;

  /**
   * Callback when a check is selected. If not provided, uses CheckContext.
   */
  onCheckSelect?: (checkId: string) => void;

  /**
   * Callback when check approval status changes.
   */
  onApprovalChange?: (checkId: string, isApproved: boolean) => void;

  /**
   * Callback when a check action is triggered.
   */
  onAction?: (checkId: string, actionType: CheckActionType) => void;

  /**
   * Callback when checks are reordered.
   */
  onReorder?: (sourceIndex: number, destinationIndex: number) => void;

  /**
   * Callback when description changes.
   */
  onDescriptionChange?: (checkId: string, description?: string) => void;

  /**
   * Callback when name changes.
   */
  onNameChange?: (checkId: string, name: string) => void;

  /**
   * Callback when create is clicked (in empty state).
   */
  onCreateCheck?: () => void;

  /**
   * Function to generate tabs for a check detail view.
   */
  getCheckTabs?: (check: Check) => CheckDetailTab[];

  /**
   * Function to generate primary actions for a check.
   */
  getPrimaryActions?: (check: Check) => CheckAction[];

  /**
   * Function to generate secondary actions for a check.
   */
  getSecondaryActions?: (check: Check) => CheckAction[];

  /**
   * Whether approval is disabled for all checks.
   */
  disableApproval?: boolean;

  /**
   * Tooltip for disabled approval.
   */
  disabledApprovalTooltip?: string;

  /**
   * Optional height for the view.
   * @default "100%"
   */
  height?: number | string;

  /**
   * Initial split pane size (percentage for list).
   * @default 30
   */
  listPaneSize?: number;

  /**
   * Minimum list pane size in pixels.
   * @default 200
   */
  minListSize?: number;

  /**
   * Maximum list pane size in pixels.
   * @default 500
   */
  maxListSize?: number;

  /**
   * Title for the check list.
   */
  listTitle?: string;

  /**
   * Optional CSS class name.
   */
  className?: string;
}

/**
 * ChecksView Component
 *
 * A high-level component for viewing and managing checks using a
 * split-pane layout with a list on the left and details on the right.
 *
 * Can receive data from:
 * 1. CheckContext (wrap with CheckProvider)
 * 2. Direct props (pass checks, selectedCheckId, etc.)
 *
 * @example Using with context
 * ```tsx
 * import { CheckProvider, ChecksView } from '@datarecce/ui';
 *
 * function App() {
 *   const { checks, isLoading } = useChecksQuery();
 *   const [selectedId, setSelectedId] = useState<string>();
 *
 *   return (
 *     <CheckProvider
 *       checks={checks}
 *       isLoading={isLoading}
 *       selectedCheckId={selectedId}
 *       onSelectCheck={setSelectedId}
 *     >
 *       <ChecksView
 *         getCheckTabs={(check) => [
 *           { id: 'result', label: 'Result', content: <ResultView check={check} /> },
 *         ]}
 *       />
 *     </CheckProvider>
 *   );
 * }
 * ```
 *
 * @example Using with direct props
 * ```tsx
 * import { ChecksView } from '@datarecce/ui';
 *
 * function App({ checks, selectedId, onSelect }) {
 *   return (
 *     <ChecksView
 *       checks={checks}
 *       selectedCheckId={selectedId}
 *       onCheckSelect={onSelect}
 *       onApprovalChange={(id, approved) => updateCheck(id, { is_checked: approved })}
 *     />
 *   );
 * }
 * ```
 */
function ChecksViewComponent({
  checks: propChecks,
  isLoading: propIsLoading,
  error: propError,
  selectedCheckId: propSelectedCheckId,
  onCheckSelect: propOnCheckSelect,
  onApprovalChange,
  onAction,
  onReorder,
  onDescriptionChange,
  onNameChange,
  onCreateCheck,
  getCheckTabs,
  getPrimaryActions,
  getSecondaryActions,
  disableApproval = false,
  disabledApprovalTooltip,
  height = "100%",
  listPaneSize = 30,
  minListSize = 200,
  maxListSize = 500,
  listTitle,
  className,
}: ChecksViewProps) {
  // Get data from context or props
  const contextValue = useCheckContext();

  const checks = propChecks ?? contextValue.checks;
  const isLoading =
    propIsLoading !== undefined ? propIsLoading : contextValue.isLoading;
  const error = propError ?? contextValue.error;
  const selectedCheckId = propSelectedCheckId ?? contextValue.selectedCheckId;
  const onSelectCheck = propOnCheckSelect ?? contextValue.onSelectCheck;

  // Convert Check to CheckCardData
  const checkCards = useMemo<CheckCardData[]>(
    () =>
      checks.map((check) => ({
        id: check.check_id,
        name: check.name,
        type: check.type as CheckCardData["type"],
        description: check.description,
        isApproved: check.is_checked,
      })),
    [checks],
  );

  // Find selected check
  const selectedCheck = useMemo(
    () => checks.find((c) => c.check_id === selectedCheckId),
    [checks, selectedCheckId],
  );

  // Handle check selection
  const handleCheckSelect = useCallback(
    (checkId: string) => {
      onSelectCheck?.(checkId);
    },
    [onSelectCheck],
  );

  // Handle action
  const handleAction = useCallback(
    (checkId: string, actionType: CheckActionType) => {
      onAction?.(checkId, actionType);
    },
    [onAction],
  );

  // Handle description change
  const handleDescriptionChange = useCallback(
    (description?: string) => {
      if (selectedCheckId) {
        onDescriptionChange?.(selectedCheckId, description);
      }
    },
    [selectedCheckId, onDescriptionChange],
  );

  // Handle name change
  const handleNameChange = useCallback(
    (name: string) => {
      if (selectedCheckId) {
        onNameChange?.(selectedCheckId, name);
      }
    },
    [selectedCheckId, onNameChange],
  );

  // Loading state
  if (isLoading) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Empty state
  if (checks.length === 0) {
    return (
      <Box
        className={className}
        sx={{
          width: "100%",
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CheckEmptyState
          title="No checks yet"
          description="Create your first check to start validating your data."
          actionText="Create Check"
          onAction={onCreateCheck}
        />
      </Box>
    );
  }

  // Build detail props
  const detailTabs = selectedCheck ? getCheckTabs?.(selectedCheck) : undefined;
  const primaryActions = selectedCheck
    ? getPrimaryActions?.(selectedCheck)
    : undefined;
  const secondaryActions = selectedCheck
    ? getSecondaryActions?.(selectedCheck)
    : undefined;

  return (
    <Box className={className} sx={{ width: "100%", height }}>
      <SplitPane
        direction="horizontal"
        sizes={[listPaneSize, 100 - listPaneSize]}
        minSizes={[minListSize, 200]}
        maxSizes={[maxListSize, Infinity]}
      >
        {/* Left pane: Check list */}
        <Box sx={{ height: "100%", overflow: "auto" }}>
          <CheckList
            checks={checkCards}
            selectedId={selectedCheckId}
            onCheckSelect={handleCheckSelect}
            onApprovalChange={onApprovalChange}
            onReorder={onReorder}
            disableApproval={disableApproval}
            disabledApprovalTooltip={disabledApprovalTooltip}
            title={listTitle}
          />
        </Box>

        {/* Right pane: Check detail */}
        <Box sx={{ height: "100%", overflow: "auto" }}>
          {selectedCheck ? (
            <CheckDetail
              checkId={selectedCheck.check_id}
              name={selectedCheck.name}
              type={selectedCheck.type}
              description={selectedCheck.description}
              isApproved={selectedCheck.is_checked}
              tabs={detailTabs}
              primaryActions={primaryActions}
              secondaryActions={secondaryActions}
              onAction={handleAction}
              onDescriptionChange={handleDescriptionChange}
              onNameChange={handleNameChange}
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography color="text.secondary">
                Select a check from the list to view details
              </Typography>
            </Box>
          )}
        </Box>
      </SplitPane>
    </Box>
  );
}

/**
 * Memoized ChecksView component for performance optimization.
 */
export const ChecksView = memo(ChecksViewComponent);
ChecksView.displayName = "ChecksView";
