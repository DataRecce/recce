import {
  Box,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Spacer,
  Spinner,
} from "@chakra-ui/react";
import { VscKebabVertical } from "react-icons/vsc";
import { Tooltip } from "@/components/ui/tooltip";
import { NodeData } from "@/lib/api/info";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { useLineageViewContext } from "../lineage/LineageViewContext";
import { SchemaDiffRow } from "./schema";

export function ColumnNameCell({
  model,
  row,
  singleEnv,
  cllRunning,
}: {
  model: NodeData;
  row: SchemaDiffRow;
  singleEnv?: boolean;
  cllRunning?: boolean;
}) {
  const lineageViewContext = useLineageViewContext();
  const { runAction } = useRecceActionContext();
  const { featureToggles } = useRecceInstanceContext();
  const { name, baseType, currentType, baseIndex, currentIndex } = row;
  const columnType = currentType ?? baseType;

  const handleProfileDiff = () => {
    runAction(
      "profile_diff",
      { model: model.name, columns: [name] },
      { showForm: false },
    );
  };

  const handleHistogramDiff = () => {
    runAction(
      "histogram_diff",
      { model: model.name, column_name: name, column_type: columnType },
      { showForm: false },
    );
  };

  const handleTopkDiff = () => {
    runAction(
      "top_k_diff",
      { model: model.name, column_name: name, k: 50 },
      { showForm: false },
    );
  };

  const handleValueDiff = () => {
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
      <Flex alignItems={"center"} gap="3px">
        <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
          {name}
        </Box>
        <Spacer />
        {cllRunning && <Spinner size="xs" color="gray.400" />}
        {!singleEnv && model.resource_type !== "source" && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <IconButton
                display="flex"
                className="row-context-menu"
                variant="plain"
                size={"sm"}
                color="gray"
                _hover={{ color: "black" }}
                disabled={featureToggles.disableDatabaseQuery}
                onClick={(e) => {
                  // prevent the click event from propagating to the Cell clicking
                  e.stopPropagation();
                }}
              >
                <Icon as={VscKebabVertical} />
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
      </Flex>
    </Tooltip>
  );
}
