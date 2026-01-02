"use client";

import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Typography from "@mui/material/Typography";
import { memo } from "react";

import { CheckCard, type CheckCardData } from "./CheckCard";

/**
 * Props for the CheckList component
 */
export interface CheckListProps {
  /** Array of checks to display */
  checks: CheckCardData[];
  /** Currently selected check ID */
  selectedId?: string | null;
  /** Callback when a check is selected */
  onCheckSelect?: (checkId: string) => void;
  /** Callback when check approval status changes */
  onApprovalChange?: (checkId: string, isApproved: boolean) => void;
  /** Callback when checks are reordered (for drag-drop implementations) */
  onReorder?: (sourceIndex: number, destinationIndex: number) => void;
  /** Whether approval is disabled for all checks */
  disableApproval?: boolean;
  /** Tooltip for disabled approval */
  disabledApprovalTooltip?: string;
  /** Optional title for the list */
  title?: string;
  /** Optional CSS class name */
  className?: string;
  /** Whether the list is loading */
  isLoading?: boolean;
  /** Content to show when list is empty */
  emptyContent?: React.ReactNode;
}

/**
 * CheckList Component
 *
 * A pure presentation component for displaying a list of checks.
 * This component does not include drag-and-drop functionality -
 * implement that at the consumer level if needed.
 *
 * @example Basic usage
 * ```tsx
 * import { CheckList } from '@datarecce/ui/primitives';
 *
 * function MyCheckList({ checks }) {
 *   const [selectedId, setSelectedId] = useState(null);
 *
 *   return (
 *     <CheckList
 *       checks={checks.map(c => ({
 *         id: c.check_id,
 *         name: c.name,
 *         type: c.type,
 *         isApproved: c.is_checked,
 *       }))}
 *       selectedId={selectedId}
 *       onCheckSelect={setSelectedId}
 *       onApprovalChange={(id, approved) => updateCheck(id, approved)}
 *     />
 *   );
 * }
 * ```
 *
 * @example With empty state
 * ```tsx
 * <CheckList
 *   checks={[]}
 *   emptyContent={<CheckEmptyState onCreateFirst={() => createCheck()} />}
 * />
 * ```
 */
function CheckListComponent({
  checks,
  selectedId,
  onCheckSelect,
  onApprovalChange,
  disableApproval = false,
  disabledApprovalTooltip,
  title,
  className,
  isLoading = false,
  emptyContent,
}: CheckListProps) {
  // Loading state
  if (isLoading) {
    return (
      <Box
        className={className}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 200,
        }}
      >
        <Typography color="text.secondary">Loading checks...</Typography>
      </Box>
    );
  }

  // Empty state
  if (checks.length === 0) {
    return (
      <Box className={className}>
        {title && (
          <Typography
            variant="subtitle2"
            sx={{ px: 2, py: 1, color: "text.secondary" }}
          >
            {title}
          </Typography>
        )}
        {emptyContent || (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 200,
            }}
          >
            <Typography color="text.secondary">No checks</Typography>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box className={className} sx={{ height: "100%", overflow: "auto" }}>
      {title && (
        <Typography
          variant="subtitle2"
          sx={{ px: 2, py: 1, color: "text.secondary" }}
        >
          {title}
        </Typography>
      )}
      <List disablePadding>
        {checks.map((check) => (
          <ListItem key={check.id} disablePadding>
            <CheckCard
              check={check}
              isSelected={selectedId === check.id}
              onClick={onCheckSelect}
              onApprovalChange={onApprovalChange}
              disableApproval={disableApproval}
              disabledApprovalTooltip={disabledApprovalTooltip}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export const CheckList = memo(CheckListComponent);
CheckList.displayName = "CheckList";
