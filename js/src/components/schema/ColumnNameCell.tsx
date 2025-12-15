import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import { VscKebabVertical } from "react-icons/vsc";
import { Menu, Portal } from "@/components/ui/mui";
import { Tooltip } from "@/components/ui/tooltip";
import { NodeData } from "@/lib/api/info";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "@/lib/api/track";
import { SchemaDiffRow } from "@/lib/dataGrid/generators/toSchemaDataGrid";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { useLineageViewContext } from "../lineage/LineageViewContext";

export function ColumnNameCell({
  model,
  row,
  singleEnv,
  cllRunning,
  showMenu = true,
}: {
  model: NodeData;
  row: SchemaDiffRow;
  singleEnv?: boolean;
  cllRunning?: boolean;
  showMenu?: boolean;
}) {
  const lineageViewContext = useLineageViewContext();
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const { name, baseType, currentType, baseIndex, currentIndex } = row;
  const columnType = currentType ?? baseType;

  const handleProfileDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.PROFILE_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "profile_diff",
      { model: model.name, columns: [name] },
      { showForm: false },
    );
  };

  const handleHistogramDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.HISTOGRAM_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "histogram_diff",
      { model: model.name, column_name: name, column_type: columnType },
      { showForm: false },
    );
  };

  const handleTopkDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.TOP_K_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "top_k_diff",
      { model: model.name, column_name: name, k: 50 },
      { showForm: false },
    );
  };

  const handleValueDiff = () => {
    trackExploreAction({
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.SCHEMA_COLUMN_MENU,
      node_count: 1,
    });
    runAction(
      "value_diff",
      { model: model.name, columns: [name] },
      { showForm: true },
    );
  };

  const addedOrRemoved = !baseType || !currentType;
  const isCllDisabled =
    lineageViewContext === undefined ||
    (baseIndex !== undefined && currentIndex === undefined);

  return (
    <Tooltip
      content="View column lineage"
      positioning={{ placement: "top" }}
      showArrow
      disabled={isCllDisabled}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: "3px" }}>
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Box>
        <Box sx={{ flex: 1 }} />
        {cllRunning && <CircularProgress size={12} color="inherit" />}
        {showMenu && !singleEnv && model.resource_type !== "source" && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                aria-label="Column options"
                className="row-context-menu"
                size="small"
                disabled={featureToggles.disableDatabaseQuery}
                onClick={(e) => {
                  // prevent the click event from propagating to the Cell clicking
                  e.stopPropagation();
                }}
              >
                <VscKebabVertical />
              </IconButton>
            </Menu.Trigger>

            <Portal>
              <Menu.Positioner>
                <Menu.Content lineHeight="20px">
                  {/* <MenuGroup title="Column" m="0" p="4px 12px">
              <MenuItem fontSize="10pt">Set Alias Name</MenuItem>
            </MenuGroup> */}
                  <Menu.ItemGroup title="Diff" m="0" p="4px 12px">
                    <Menu.Item
                      value="profile-diff"
                      fontSize="0.85rem"
                      onClick={handleProfileDiff}
                      disabled={addedOrRemoved}
                    >
                      Profile Diff
                    </Menu.Item>
                    <Menu.Item
                      value="histogram-diff"
                      fontSize="0.85rem"
                      onClick={handleHistogramDiff}
                      disabled={
                        addedOrRemoved ||
                        (columnType ? !supportsHistogramDiff(columnType) : true)
                      }
                    >
                      Histogram Diff
                    </Menu.Item>
                    <Menu.Item
                      value="top-k-diff"
                      fontSize="0.85rem"
                      onClick={handleTopkDiff}
                      disabled={addedOrRemoved}
                    >
                      Top-k Diff
                    </Menu.Item>
                    <Menu.Item
                      value="value-diff"
                      fontSize="0.85rem"
                      onClick={handleValueDiff}
                      disabled={addedOrRemoved}
                    >
                      Value Diff
                    </Menu.Item>
                  </Menu.ItemGroup>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}
      </Box>
    </Tooltip>
  );
}
