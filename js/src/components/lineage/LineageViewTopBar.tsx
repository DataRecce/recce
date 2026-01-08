import { type LineageDiffViewOptions } from "@datarecce/ui/api";
import { getIconForResourceType } from "@datarecce/ui/components/lineage";
import {
  useRecceInstanceContext,
  useRecceServerFlag,
} from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
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
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiPackage } from "react-icons/fi";
import { PiCaretDown } from "react-icons/pi";
import SetupConnectionPopover from "@/components/app/SetupConnectionPopover";
import HistoryToggle from "@/components/shared/HistoryToggle";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphAdapter";
import { findByRunType } from "../run/registry";
import { useLineageViewContextSafe } from "./LineageViewContext";

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

const ViewModeSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();
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

const PackageSelectMenu = ({ isDisabled }: { isDisabled: boolean }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const { lineageGraph } = useLineageGraphContext();
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

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

const NodeSelectionInput = (props: {
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  tooltipComponent?: React.ReactNode;
}) => {
  const [inputValue, setInputValue] = useState(props.value);
  const { data: flags } = useRecceServerFlag();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = props.value;
    }
  }, [props.value]);

  return (
    <MuiTooltip
      title={flags?.single_env_onboarding ? props.tooltipComponent : ""}
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
        disabled={props.isDisabled}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter") {
            props.onChange(inputValue);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setInputValue(props.value);
            if (inputRef.current) {
              inputRef.current.blur();
            }
          }
        }}
        onBlur={() => {
          setInputValue(props.value);
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

const SelectFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

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
    />
  );
};

const ExcludeFilter = ({ isDisabled }: { isDisabled: boolean }) => {
  const { viewOptions, onViewOptionsChanged } = useLineageViewContextSafe();

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

const ControlItem = (props: {
  label?: string;
  children: React.ReactNode;
  style?: CSSProperties;
}) => {
  return (
    <Box style={props.style} sx={{ maxWidth: 300 }}>
      <Typography fontSize="8pt">
        {(props.label ?? "").trim() || <>&nbsp;</>}
      </Typography>
      {props.children}
    </Box>
  );
};

export const LineageViewTopBar = () => {
  const { deselect, focusedNode, selectedNodes, ...lineageViewContext } =
    useLineageViewContextSafe();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flags } = useRecceServerFlag();
  const isSingleEnvOnboarding = flags?.single_env_onboarding;

  const [actionsAnchorEl, setActionsAnchorEl] = useState<HTMLElement | null>(
    null,
  );
  const actionsOpen = Boolean(actionsAnchorEl);

  const isSingleSelect = !!focusedNode;
  const isMultiSelect = selectedNodes.length > 0;
  const isNoSelect = !isSingleSelect && !isMultiSelect;
  const isFilterDisabled = isMultiSelect;

  const handleActionsClick = (event: MouseEvent<HTMLButtonElement>) => {
    setActionsAnchorEl(event.currentTarget);
  };

  const handleActionsClose = () => {
    setActionsAnchorEl(null);
  };

  // Get icons
  const RowCountDiffIcon = findByRunType("row_count_diff").icon;
  const ValueDiffIcon = findByRunType("value_diff").icon;
  const LineageDiffIcon = findByRunType("lineage_diff").icon;
  const SchemaDiffIcon = findByRunType("schema_diff").icon;

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
        <HistoryToggle />
        <ControlItem label="Mode" style={{ flexShrink: 1 }}>
          <ViewModeSelectMenu isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Package" style={{ flexShrink: 1 }}>
          <PackageSelectMenu isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Select" style={{ flexShrink: 1 }}>
          <SelectFilter isDisabled={isFilterDisabled} />
        </ControlItem>
        <ControlItem label="Exclude" style={{ flexShrink: 1 }}>
          <ExcludeFilter isDisabled={isFilterDisabled} />
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
                  deselect();
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
                        await lineageViewContext.runRowCount();
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
                <SetupConnectionPopover
                  display={featureToggles.mode === "metadata only"}
                >
                  <MenuItem
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={async () => {
                      await lineageViewContext.runRowCountDiff();
                      handleActionsClose();
                    }}
                  >
                    <ListItemIcon>
                      <RowCountDiffIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Row Count Diff</ListItemText>
                  </MenuItem>
                </SetupConnectionPopover>
                <SetupConnectionPopover
                  display={featureToggles.mode === "metadata only"}
                >
                  <MenuItem
                    disabled={featureToggles.disableDatabaseQuery}
                    onClick={async () => {
                      await lineageViewContext.runValueDiff();
                      handleActionsClose();
                    }}
                  >
                    <ListItemIcon>
                      <ValueDiffIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Value Diff</ListItemText>
                  </MenuItem>
                </SetupConnectionPopover>

                <Divider />

                <ListSubheader
                  sx={{ lineHeight: "32px", bgcolor: "transparent" }}
                >
                  Add to Checklist
                </ListSubheader>
                <MenuItem
                  disabled={
                    !(isNoSelect || (isMultiSelect && selectedNodes.length > 1))
                  }
                  onClick={() => {
                    lineageViewContext.addLineageDiffCheck(
                      lineageViewContext.viewOptions.view_mode,
                    );
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
                    lineageViewContext.addSchemaDiffCheck();
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
