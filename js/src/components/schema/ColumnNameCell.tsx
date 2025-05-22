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
  Spinner,
} from "@chakra-ui/react";
import { VscKebabVertical } from "react-icons/vsc";
import { supportsHistogramDiff } from "../histogram/HistogramDiffForm";
import { NodeData } from "@/lib/api/info";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

export function ColumnNameCell({
  model,
  name,
  baseType,
  currentType,
  singleEnv,
  cllRunning,
}: {
  model: NodeData;
  name: string;
  baseType?: string;
  currentType?: string;
  singleEnv?: boolean;
  cllRunning?: boolean;
}) {
  const { runAction } = useRecceActionContext();
  const { readOnly } = useRecceInstanceContext();
  const columnType = currentType ?? baseType;

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

  return (
    <Flex alignItems={"center"} gap="3px">
      <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {name}
      </Box>
      <Spacer />
      {cllRunning && <Spinner size="xs" color="gray.400" />}
      {!singleEnv && model.resource_type !== "source" && (
        <Menu>
          {({ isOpen }) => (
            <>
              <MenuButton
                display="flex"
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
                isDisabled={readOnly}
                onClick={(e) => {
                  // prevent the click event from propagating to the Cell clicking
                  e.stopPropagation();
                }}
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
                      isDisabled={addedOrRemoved}>
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
