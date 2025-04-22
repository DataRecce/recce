import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import {
  Box,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Portal,
  Spacer,
  Tooltip,
} from "@chakra-ui/react";
import { VscKebabVertical } from "react-icons/vsc";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { LuEye } from "react-icons/lu";
import { useLineageViewContext } from "../lineage/LineageViewContext";
import { trackColumnLevelLineage } from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { NodeData } from "@/lib/api/info";
import { useState } from "react";

export function ColumnNameCell({
  model,
  name,
  baseType,
  currentType,
  singleEnv,
}: {
  model: NodeData;
  name: string;
  baseType?: string;
  currentType?: string;
  singleEnv?: boolean;
}) {
  const { runAction } = useRecceActionContext();
  const lineageViewContext = useLineageViewContext();
  const { isActionAvailable } = useLineageGraphContext();
  const columnType = currentType ?? baseType;
  const [cllRunning, setCllRunning] = useState(false);

  const handleProfileDiff = () => {
    runAction("profile_diff", { model: model.name, columns: [name] }, { showForm: false });
  };

  const handleHistogramDiff = () => {
    runAction(
      "histogram_diff",
      { model: model.name, column_name: name, column_type: columnType },
      { showForm: false },
    );
  };

  const handleTopkDiff = () => {
    runAction("top_k_diff", { model: model.name, column_name: name, k: 50 }, { showForm: false });
  };
  const addedOrRemoved = !baseType || !currentType;

  const handleViewCll = async () => {
    trackColumnLevelLineage({ action: "view", source: "schema_column" });
    setCllRunning(true);
    await lineageViewContext?.showColumnLevelLineage(model.id, name);
    setCllRunning(false);
  };

  return (
    <Flex alignItems={"center"} gap="3px">
      <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {name}
      </Box>
      <Spacer />
      {/* show icon button with eye icon */}
      {lineageViewContext && (
        <Tooltip label="Show Lineage">
          <IconButton
            icon={<LuEye />}
            aria-label={""}
            className="row-context-menu"
            visibility="hidden"
            width={"0px"}
            minWidth={"0px"}
            variant="unstyled"
            size={"sm"}
            color="gray"
            _hover={{ color: "black" }}
            onClick={handleViewCll}
            isLoading={cllRunning}
          />
        </Tooltip>
      )}
      {!singleEnv && model.resource_type !== "source" && (
        <Menu>
          {({ isOpen }) => (
            <>
              <MenuButton
                className="row-context-menu"
                visibility={isOpen ? "visible" : "hidden"}
                width={isOpen ? "auto" : "0px"}
                minWidth={isOpen ? "auto" : "0px"}
                as={IconButton}
                icon={<Icon as={VscKebabVertical} />}
                variant="unstyled"
                size={"sm"}
                color="gray"
                _hover={{ color: "black" }}
              />

              <Portal>
                <MenuList lineHeight="20px">
                  {/* <MenuGroup title="Column" m="0" p="4px 12px">
              <MenuItem fontSize="10pt">Set Alias Name</MenuItem>
            </MenuGroup> */}
                  <MenuGroup title="Diff" m="0" p="4px 12px">
                    <MenuItem
                      fontSize="10pt"
                      onClick={handleProfileDiff}
                      isDisabled={addedOrRemoved || !isActionAvailable("profile_diff")}>
                      Profile Diff
                    </MenuItem>
                    <MenuItem
                      fontSize="10pt"
                      onClick={handleHistogramDiff}
                      isDisabled={
                        addedOrRemoved || (columnType ? !supportsHistogramDiff(columnType) : true)
                      }>
                      Histogram Diff
                    </MenuItem>
                    <MenuItem fontSize="10pt" onClick={handleTopkDiff} isDisabled={addedOrRemoved}>
                      Top-k Diff
                    </MenuItem>
                  </MenuGroup>
                </MenuList>
              </Portal>
            </>
          )}
        </Menu>
      )}
    </Flex>
  );
}
