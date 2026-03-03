"use client";

/**
 * @file LineageViewTopBar.tsx
 * @description Core LineageViewTopBar component with dependency injection.
 *
 * This component provides the top toolbar for the lineage view with filtering,
 * mode selection, package filtering, and action menus. It uses dependency injection
 * for consumer-specific features like routing, tracking, and run type icons.
 *
 * @example
 * ```tsx
 * import { LineageViewTopBar } from '@datarecce/ui/components/lineage';
 *
 * <LineageViewTopBar
 *   viewOptions={viewOptions}
 *   onViewOptionsChanged={handleViewOptionsChanged}
 *   lineageGraph={lineageGraph}
 *   featureToggles={featureToggles}
 *   serverFlags={serverFlags}
 *   selectedNodes={selectedNodes}
 *   focusedNode={focusedNode}
 *   onDeselect={handleDeselect}
 *   onRunRowCount={handleRunRowCount}
 *   onRunRowCountDiff={handleRunRowCountDiff}
 *   onRunValueDiff={handleRunValueDiff}
 *   onAddLineageDiffCheck={handleAddLineageDiffCheck}
 *   onAddSchemaDiffCheck={handleAddSchemaDiffCheck}
 *   runTypeIcons={runTypeIcons}
 *   historyToggleSlot={<HistoryToggle />}
 *   setupConnectionPopoverSlot={SetupConnectionPopover}
 * />
 * ```
 */

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiPackage } from "react-icons/fi";
import { PiCaretDown } from "react-icons/pi";
import type { RecceServerFlags } from "../../../api/flag";
import type { LineageDiffViewOptions } from "../../../api/lineagecheck";
import type { RecceFeatureToggles } from "../../../contexts/instance/types";
import type {
  LineageGraph,
  LineageGraphNode,
} from "../../../contexts/lineage/types";
import { useIsDark } from "../../../hooks/useIsDark";
import type { IconComponent } from "../../run/types";
import { getIconForResourceType } from "../styles";

// ============================================================================
// Types
// ============================================================================

/**
 * Icons for run types used in action menus.
 * Consumers inject their own icons based on their run type registry.
 */
export interface RunTypeIcons {
  /** Icon for row_count_diff action */
  rowCountDiff: IconComponent;
  /** Icon for value_diff action */
  valueDiff: IconComponent;
  /** Icon for lineage_diff action */
  lineageDiff: IconComponent;
  /** Icon for schema_diff action */
  schemaDiff: IconComponent;
}

/**
 * Props for the SetupConnectionPopover slot component.
 */
export interface SetupConnectionPopoverSlotProps {
  /** Whether to display the popover */
  display: boolean;
  /** Child element to wrap */
  children: ReactNode;
}

/**
 * Props for the LineageViewTopBar component.
 */
export interface LineageViewTopBarProps {
  // View options and state
  /** Current view options for filtering and display mode */
  viewOptions: LineageDiffViewOptions;
  /** Callback when view options change */
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
  /** The lineage graph data */
  lineageGraph?: LineageGraph;
  /** Feature toggles controlling what is enabled */
  featureToggles: RecceFeatureToggles;
  /** Server-side feature flags */
  serverFlags?: RecceServerFlags;

  // Selection state
  /** Currently focused node (hovered/highlighted) */
  focusedNode?: LineageGraphNode;
  /** Currently selected nodes for batch operations */
  selectedNodes: LineageGraphNode[];
  /** Callback to clear selection */
  onDeselect: () => void;

  // Action callbacks
  /** Callback for running row count (single env mode) */
  onRunRowCount?: () => Promise<void>;
  /** Callback for running row count diff */
  onRunRowCountDiff?: () => Promise<void>;
  /** Callback for running value diff */
  onRunValueDiff?: () => Promise<void>;
  /** Callback for adding a lineage diff check */
  onAddLineageDiffCheck?: (
    viewMode?: LineageDiffViewOptions["view_mode"],
  ) => void;
  /** Callback for adding a schema diff check */
  onAddSchemaDiffCheck?: () => void;

  // Dependency injection slots
  /** Icons for run types in action menus */
  runTypeIcons: RunTypeIcons;
  /** Slot for history toggle component */
  historyToggleSlot?: ReactNode;
  /** Component for setup connection popover wrapper */
  SetupConnectionPopoverSlot?: ComponentType<SetupConnectionPopoverSlotProps>;
}

// ============================================================================
// Internal Components
// ============================================================================

const getCodeBlockSx = (isDark: boolean) => ({
  fontSize: "8pt",
  bgcolor: isDark ? "grey.700" : "grey.100",
  px: 0.5,
  borderRadius: 1,
});

const SelectFilterTooltip = () => {
  const isDark = useIsDark();
  const codeBlockSx = getCodeBlockSx(isDark);
  return (
    <Stack alignItems="flex-start" spacing={0}>
      <Typography fontSize="10pt" color="text.secondary" pb={1}>
        Select nodes by dbt node selector syntax
      </Typography>
      <Typography fontSize="8pt">
        <Box component="code" sx={codeBlockSx}>
          model_name
        </Box>{" "}
        Select a node
      </Typography>
      <Typography fontSize="8pt">
        <Box component="code" sx={codeBlockSx}>
          model_name+
        </Box>{" "}
        Select downstream nodes
      </Typography>
      <Typography fontSize="8pt">
        <Box component="code" sx={codeBlockSx}>
          +model_name
        </Box>{" "}
        Select upstream nodes
      </Typography>
      <Typography fontSize="8pt">
        <Box component="code" sx={codeBlockSx}>
          model*
        </Box>{" "}
        Select by wildcard
      </Typography>
    </Stack>
  );
};

interface ViewModeSelectMenuProps {
  isDisabled: boolean;
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
}

const ViewModeSelectMenu = ({
  isDisabled,
  viewOptions,
  onViewOptionsChanged,
}: ViewModeSelectMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const viewMode = viewOptions.view_mode ?? "changed_models";
  const label = viewMode === "changed_models" ? "Changed Models" : "All";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (newViewMode: LineageDiffViewOptions["view_mode"]) => {
    onViewOptionsChanged({
      ...viewOptions,
      view_mode: newViewMode,
    });
    handleClose();
  };

  const ModelIcon = getIconForResourceType("model").icon;

  return (
    <>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        onClick={handleClick}
        disabled={isDisabled}
        startIcon={ModelIcon && <ModelIcon />}
        endIcon={<PiCaretDown />}
        sx={{ minWidth: 100, textTransform: "none", fontSize: "0.75rem" }}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
          mode
        </ListSubheader>
        <RadioGroup value={viewMode}>
          <MenuItem onClick={() => handleSelect("changed_models")}>
            <FormControlLabel
              value="changed_models"
              control={<Radio size="small" sx={{ py: 0 }} />}
              label="Changed Models"
              sx={{ m: 0 }}
            />
          </MenuItem>
          <MenuItem onClick={() => handleSelect("all")}>
            <FormControlLabel
              value="all"
              control={<Radio size="small" sx={{ py: 0 }} />}
              label="All"
              sx={{ m: 0 }}
            />
          </MenuItem>
        </RadioGroup>
      </Menu>
    </>
  );
};

interface PackageSelectMenuProps {
  isDisabled: boolean;
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
  lineageGraph?: LineageGraph;
}

const PackageSelectMenu = ({
  isDisabled,
  viewOptions,
  onViewOptionsChanged,
  lineageGraph,
}: PackageSelectMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  // get unique package names
  const available = new Set<string>();
  const nodes = Object.values(lineageGraph?.nodes ?? {});
  for (const node of nodes) {
    if (node.data.packageName) {
      available.add(node.data.packageName);
    }
  }

  const projectName = lineageGraph?.manifestMetadata.current?.project_name;

  const selected = viewOptions.packages
    ? new Set(viewOptions.packages)
    : projectName
      ? new Set([projectName])
      : available;
  const isSelectAll = selected.size === available.size;
  const isSelectNone = selected.size === 0;
  const label =
    selected.size === 1
      ? Array.from(selected)[0]
      : isSelectAll
        ? "All Packages"
        : isSelectNone
          ? "No Package"
          : `${selected.size} Packages`;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      onViewOptionsChanged({
        ...viewOptions,
        packages: [],
      });
    } else {
      onViewOptionsChanged({
        ...viewOptions,
        packages: Array.from(available),
      });
    }
  };

  const handleSelect = (pkg: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(pkg)) {
      newSelected.delete(pkg);
    } else {
      newSelected.add(pkg);
    }
    onViewOptionsChanged({
      ...viewOptions,
      packages: Array.from(newSelected),
    });
  };

  return (
    <>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        onClick={handleClick}
        disabled={isDisabled}
        startIcon={<FiPackage />}
        endIcon={<PiCaretDown />}
        sx={{ minWidth: 100, textTransform: "none", fontSize: "0.75rem" }}
      >
        {label}
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
          Select Packages
        </ListSubheader>
        <MenuItem onClick={handleSelectAll}>
          <Checkbox
            checked={isSelectAll}
            indeterminate={!isSelectAll && !isSelectNone}
            size="small"
            sx={{ py: 0 }}
          />
          <ListItemText>Select All</ListItemText>
        </MenuItem>

        <Divider />

        {Array.from(available).map((pkg) => (
          <MenuItem key={pkg} onClick={() => handleSelect(pkg)}>
            <Checkbox checked={selected.has(pkg)} size="small" sx={{ py: 0 }} />
            <ListItemText className="no-track-pii-safe">{pkg}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

interface NodeSelectionInputProps {
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  tooltipComponent?: ReactNode;
  showTooltip?: boolean;
}

const NodeSelectionInput = ({
  value,
  onChange,
  isDisabled,
  tooltipComponent,
  showTooltip = true,
}: NodeSelectionInputProps) => {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <MuiTooltip
      title={showTooltip ? tooltipComponent : ""}
      placement="bottom-start"
      slotProps={{
        tooltip: {
          sx: {
            width: "18.75rem",
            p: 2,
            boxShadow: 3,
            border: 1,
            borderRadius: 1,
            color: "text.primary",
            bgcolor: "background.paper",
          },
        },
      }}
    >
      <TextField
        inputRef={inputRef}
        size="small"
        placeholder="with selectors"
        disabled={isDisabled}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter") {
            onChange(inputValue);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setInputValue(value);
            if (inputRef.current) {
              inputRef.current.blur();
            }
          }
        }}
        onBlur={() => {
          setInputValue(value);
        }}
        sx={{
          "& .MuiInputBase-root": {
            width: "18.75rem",
            height: 24,
            fontSize: "0.75rem",
          },
          "& .MuiInputBase-input": {
            py: 0.5,
            px: 1,
          },
        }}
      />
    </MuiTooltip>
  );
};

interface SelectFilterProps {
  isDisabled: boolean;
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
  showTooltip?: boolean;
}

const SelectFilter = ({
  isDisabled,
  viewOptions,
  onViewOptionsChanged,
  showTooltip,
}: SelectFilterProps) => {
  return (
    <NodeSelectionInput
      isDisabled={isDisabled}
      value={viewOptions.select ?? ""}
      onChange={(value) => {
        onViewOptionsChanged({
          ...viewOptions,
          select: value ? value : undefined,
        });
      }}
      tooltipComponent={<SelectFilterTooltip />}
      showTooltip={showTooltip}
    />
  );
};

interface ExcludeFilterProps {
  isDisabled: boolean;
  viewOptions: LineageDiffViewOptions;
  onViewOptionsChanged: (options: LineageDiffViewOptions) => void;
}

const ExcludeFilter = ({
  isDisabled,
  viewOptions,
  onViewOptionsChanged,
}: ExcludeFilterProps) => {
  return (
    <NodeSelectionInput
      isDisabled={isDisabled}
      value={viewOptions.exclude ?? ""}
      onChange={(value) => {
        onViewOptionsChanged({
          ...viewOptions,
          exclude: value ? value : undefined,
        });
      }}
    />
  );
};

interface ControlItemProps {
  label?: string;
  children: ReactNode;
  style?: CSSProperties;
}

const ControlItem = ({ label, children, style }: ControlItemProps) => {
  return (
    <Box style={style} sx={{ maxWidth: 300 }}>
      <Typography fontSize="8pt">
        {(label ?? "").trim() || <>&nbsp;</>}
      </Typography>
      {children}
    </Box>
  );
};

// ============================================================================
// Default Setup Connection Popover (passthrough)
// ============================================================================

const DefaultSetupConnectionPopover = ({
  children,
}: SetupConnectionPopoverSlotProps) => {
  return <>{children}</>;
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * LineageViewTopBar Component
 *
 * Top toolbar for the lineage view providing:
 * - View mode selection (Changed Models vs All)
 * - Package filtering
 * - Node selector filters (Select, Exclude)
 * - Actions menu for diff operations and checklist additions
 * - Multi-node selection controls
 *
 * This component uses dependency injection for consumer-specific features
 * like history toggle, setup connection popover, and run type icons.
 */
export const LineageViewTopBar = ({
  viewOptions,
  onViewOptionsChanged,
  lineageGraph,
  featureToggles,
  serverFlags,
  focusedNode,
  selectedNodes,
  onDeselect,
  onRunRowCount,
  onRunRowCountDiff,
  onRunValueDiff,
  onAddLineageDiffCheck,
  onAddSchemaDiffCheck,
  runTypeIcons,
  historyToggleSlot,
  SetupConnectionPopoverSlot = DefaultSetupConnectionPopover,
}: LineageViewTopBarProps) => {
  const isSingleEnvOnboarding = serverFlags?.single_env_onboarding;

  const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const actionsOpen = Boolean(actionsAnchorEl);

  const isMultiSelect = selectedNodes.length > 0;
  const isFilterDisabled = isMultiSelect;

  const handleActionsClick = (event: MouseEvent<HTMLButtonElement>) => {
    setActionsAnchorEl(event.currentTarget);
  };

  const handleActionsClose = () => {
    setActionsAnchorEl(null);
  };

  // Get icons from dependency injection
  const RowCountDiffIcon = runTypeIcons.rowCountDiff;
  const ValueDiffIcon = runTypeIcons.valueDiff;
  const LineageDiffIcon = runTypeIcons.lineageDiff;
  const SchemaDiffIcon = runTypeIcons.schemaDiff;

  return (
    <Stack
      direction="row"
      alignItems="center"
      borderBottom={1}
      borderColor="neutral.light"
      sx={{ width: "100%", p: "4pt 8pt", gap: "0.5rem" }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ flex: 1, gap: "0.5rem" }}
      >
        {historyToggleSlot}
        <ControlItem label="Mode" style={{ flexShrink: 1 }}>
          <ViewModeSelectMenu
            isDisabled={isFilterDisabled}
            viewOptions={viewOptions}
            onViewOptionsChanged={onViewOptionsChanged}
          />
        </ControlItem>
        <ControlItem label="Package" style={{ flexShrink: 1 }}>
          <PackageSelectMenu
            isDisabled={isFilterDisabled}
            viewOptions={viewOptions}
            onViewOptionsChanged={onViewOptionsChanged}
            lineageGraph={lineageGraph}
          />
        </ControlItem>
        <ControlItem label="Select" style={{ flexShrink: 1 }}>
          <SelectFilter
            isDisabled={isFilterDisabled}
            viewOptions={viewOptions}
            onViewOptionsChanged={onViewOptionsChanged}
            showTooltip={isSingleEnvOnboarding}
          />
        </ControlItem>
        <ControlItem label="Exclude" style={{ flexShrink: 1 }}>
          <ExcludeFilter
            isDisabled={isFilterDisabled}
            viewOptions={viewOptions}
            onViewOptionsChanged={onViewOptionsChanged}
          />
        </ControlItem>
        <Box sx={{ flexGrow: 1 }} />
        {isMultiSelect && (
          <>
            <ControlItem label="" style={{ flexShrink: 0 }}>
              <Typography fontSize="9pt" color="text.secondary">
                {selectedNodes.length > 1
                  ? `${selectedNodes.length} nodes selected`
                  : `${selectedNodes.length} node selected`}
              </Typography>
            </ControlItem>

            <ControlItem label="">
              <Button
                variant="outlined"
                color="neutral"
                size="xsmall"
                onClick={() => {
                  onDeselect();
                }}
                sx={{ textTransform: "none", fontSize: "9pt" }}
              >
                Deselect
              </Button>
            </ControlItem>
            {isSingleEnvOnboarding && (
              <ControlItem label="Explore">
                <Box sx={{ display: "inline-flex" }}>
                  <Button
                    size="xsmall"
                    color="neutral"
                    variant="outlined"
                    onClick={handleActionsClick}
                    endIcon={<PiCaretDown />}
                    sx={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    Actions
                  </Button>
                  <Menu
                    anchorEl={actionsAnchorEl}
                    open={actionsOpen}
                    onClose={handleActionsClose}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <MenuItem
                      disabled={featureToggles.disableDatabaseQuery}
                      onClick={async () => {
                        await onRunRowCount?.();
                        handleActionsClose();
                      }}
                    >
                      <ListItemIcon>
                        <RowCountDiffIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Row Count</ListItemText>
                    </MenuItem>
                  </Menu>
                </Box>
              </ControlItem>
            )}
          </>
        )}
        {!isSingleEnvOnboarding && (
          <ControlItem label="Explore">
            <Box sx={{ display: "inline-flex" }}>
              <Button
                size="xsmall"
                color="neutral"
                variant="outlined"
                disabled={featureToggles.disableViewActionDropdown}
                onClick={handleActionsClick}
                endIcon={<PiCaretDown />}
                sx={{ textTransform: "none", fontSize: "0.75rem" }}
              >
                Actions
              </Button>
              <Menu
                anchorEl={actionsAnchorEl}
                open={actionsOpen}
                onClose={handleActionsClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <ListSubheader
                  sx={{ lineHeight: "32px", bgcolor: "transparent" }}
                >
                  Diff
                </ListSubheader>
                <SetupConnectionPopoverSlot
                  display={featureToggles.mode === "metadata only"}
                >
                  <MenuItem
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={async () => {
                      await onRunRowCountDiff?.();
                      handleActionsClose();
                    }}
                  >
                    <ListItemIcon>
                      <RowCountDiffIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Row Count Diff</ListItemText>
                  </MenuItem>
                </SetupConnectionPopoverSlot>
                <SetupConnectionPopoverSlot
                  display={featureToggles.mode === "metadata only"}
                >
                  <MenuItem
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={async () => {
                      await onRunValueDiff?.();
                      handleActionsClose();
                    }}
                  >
                    <ListItemIcon>
                      <ValueDiffIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Value Diff</ListItemText>
                  </MenuItem>
                </SetupConnectionPopoverSlot>

                <Divider />

                <ListSubheader
                  sx={{ lineHeight: "32px", bgcolor: "transparent" }}
                >
                  Add to Checklist
                </ListSubheader>
                <MenuItem
                  onClick={() => {
                    onAddLineageDiffCheck?.(viewOptions.view_mode);
                    handleActionsClose();
                  }}
                >
                  <ListItemIcon>
                    <LineageDiffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Lineage Diff</ListItemText>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    onAddSchemaDiffCheck?.();
                    handleActionsClose();
                  }}
                >
                  <ListItemIcon>
                    <SchemaDiffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Schema Diff</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          </ControlItem>
        )}
      </Stack>
    </Stack>
  );
};
