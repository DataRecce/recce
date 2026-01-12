"use client";

/**
 * @file run/RunModal.tsx
 * @description Modal dialog for configuring and executing runs with forms.
 *
 * This component provides a generic modal for run form interactions.
 * OSS-specific behavior (tracking, documentation URLs) is injected via props.
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import MuiPopover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { type ComponentType, ReactNode, useRef, useState } from "react";
import { IconBaseProps } from "react-icons";
import { IoClose } from "react-icons/io5";
import type { Run, RunType } from "../../api";
import type { RunFormProps } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the RunModal component.
 *
 * @template PT - The type of form parameters used by the RunForm component
 */
export interface RunModalProps<PT = unknown> {
  /** Whether the modal is currently open */
  isOpen: boolean;

  /** Callback when the modal is closed (via X button, backdrop click, or escape key) */
  onClose: () => void;

  /** Callback when the execute button is clicked with valid parameters */
  onExecute: (type: RunType, params: PT) => void;

  /** The title displayed in the modal header */
  title: string;

  /** The run type being configured */
  type: RunType;

  /** Initial/default parameters for the form */
  params?: PT;

  /** The initial run to display (for edit scenarios) */
  initialRun?: Run;

  /** The form component to render for configuring run parameters */
  RunForm?: ComponentType<RunFormProps<PT>>;

  /**
   * Optional callback when the modal is cancelled (X button clicked without executing).
   * Use this for analytics/tracking of form cancellations.
   */
  onCancel?: () => void;

  /**
   * Optional callback when execute is clicked.
   * Use this for analytics/tracking of form submissions.
   */
  onExecuteClick?: () => void;

  /**
   * Optional documentation URL for the run type.
   * If provided, an info icon will be shown that links to the documentation.
   */
  documentationUrl?: string | null;

  /**
   * Optional icon component to display next to the documentation link.
   * Can be any component - will be wrapped by MUI Box with fontSize styling.
   * Compatible with react-icons, custom SVG components, or MUI icons.
   */
  InfoIcon?: ComponentType<IconBaseProps>;
}

// ============================================================================
// Default Info Icon
// ============================================================================

/**
 * Default info icon component - a simple info circle.
 * OSS and Cloud consumers can override with their own icons.
 */
const DefaultInfoIcon = ({ size = 16 }: { size?: string | number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

/**
 * RunModal - A dialog for configuring and executing runs.
 *
 * This component renders a modal dialog with:
 * - A title with optional documentation link
 * - A form for configuring run parameters (optional)
 * - Execute and close actions
 *
 * The modal supports dependency injection for:
 * - Form component (`RunForm`) - for run-type-specific parameter forms
 * - Tracking callbacks (`onCancel`, `onExecuteClick`) - for analytics
 * - Documentation URL (`documentationUrl`) - for help links
 * - Info icon (`InfoIcon`) - for customizing the documentation link icon
 *
 * @example
 * ```tsx
 * <RunModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onExecute={handleExecute}
 *   title="Profile Diff"
 *   type="profile_diff"
 *   params={{ model: "my_model" }}
 *   RunForm={ProfileDiffForm}
 *   documentationUrl="https://docs.datarecce.io/features/lineage/#profile-diff"
 * />
 * ```
 */
export function RunModal<PT = unknown>({
  isOpen,
  onClose,
  onExecute,
  type,
  title,
  params: defaultParams,
  RunForm,
  onCancel,
  onExecuteClick,
  documentationUrl,
  InfoIcon = DefaultInfoIcon,
}: RunModalProps<PT>) {
  const [params, setParams] = useState<Partial<PT>>(
    (defaultParams ?? {}) as Partial<PT>,
  );
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isReadyToExecute, setIsReadyToExecute] = useState(false);
  const executeClicked = useRef(false);

  const handleClose = () => {
    if (!executeClicked.current) {
      // Track cancellation if callback provided
      onCancel?.();
    }
    executeClicked.current = false; // Reset for next open
    onClose();
  };

  const handleExecuteClick = () => {
    executeClicked.current = true;
    // Track execute click if callback provided
    onExecuteClick?.();
    onExecute(type, params as PT);
  };

  return (
    <MuiDialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: { sx: { height: "75%", minHeight: "400px" } },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        {title}{" "}
        {documentationUrl && (
          <>
            <IconButton
              size="small"
              aria-label="Click this button to learn more about the SQL behind"
              onMouseEnter={(e) => setAnchorEl(e.currentTarget)}
              onMouseLeave={() => setAnchorEl(null)}
              onClick={() => window.open(documentationUrl, "_blank")}
            >
              <Box component={InfoIcon} sx={{ fontSize: "16px" }} />
            </IconButton>
            <MuiPopover
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              disableRestoreFocus
              sx={{ pointerEvents: "none" }}
              slotProps={{
                paper: {
                  sx: { bgcolor: "black", color: "white", p: 1 },
                },
              }}
            >
              <Typography sx={{ fontSize: "0.875rem" }}>
                Click{" "}
                <Link
                  href={documentationUrl}
                  target="_blank"
                  sx={{
                    textDecoration: "underline",
                    color: "white",
                    "&:hover": { color: "iochmara.300" },
                  }}
                >
                  here
                </Link>{" "}
                to learn more about the SQL behind
              </Typography>
            </MuiPopover>
          </>
        )}
      </DialogTitle>
      <IconButton
        aria-label="close"
        onClick={handleClose}
        sx={{
          position: "absolute",
          right: 8,
          top: 8,
          color: "grey.500",
        }}
      >
        <IoClose />
      </IconButton>
      <DialogContent
        sx={{
          p: 0,
          overflow: "auto",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ contain: "layout" }}>
          {RunForm && (
            <RunForm
              params={params}
              onParamsChanged={setParams}
              setIsReadyToExecute={setIsReadyToExecute}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing="10px">
          <Button
            disabled={!isReadyToExecute}
            color="iochmara"
            variant="contained"
            onClick={handleExecuteClick}
          >
            Execute
          </Button>
        </Stack>
      </DialogActions>
    </MuiDialog>
  );
}
