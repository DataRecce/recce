import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import {
  Flex,
  Box,
  Spacer,
  Menu,
  MenuButton,
  IconButton,
  Icon,
  Portal,
  MenuList,
  MenuGroup,
  MenuItem,
} from "@chakra-ui/react";
import { VscKebabVertical } from "react-icons/vsc";

export function ColumnNameCell({
  model,
  columnName,
  columnType,
}: //   containerRef,
{
  model: string;
  columnName: string;
  columnType: string;
  //   containerRef: React.RefObject<any>;
}) {
  const { runAction } = useRecceActionContext();

  const handleHistogramDiff = () => {
    runAction(
      "histogram_diff",
      { model, column_name: columnName, column_type: columnType },
      { showForm: false }
    );
  };

  const handleTopkDiff = () => {
    runAction(
      "top_k_diff",
      { model, column_name: columnName, k: 50 },
      { showForm: false }
    );
  };

  return (
    <Flex>
      <Box overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {columnName}
      </Box>
      <Spacer />

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
            />

            <Portal
            // containerRef={containerRef}
            >
              <MenuList lineHeight="20px">
                <MenuGroup title="Diff" m="0" p="4px 12px">
                  <MenuItem fontSize="10pt" onClick={handleHistogramDiff}>
                    Histogram Diff
                  </MenuItem>
                  <MenuItem fontSize="10pt" onClick={handleTopkDiff}>
                    Top-k Diff
                  </MenuItem>
                </MenuGroup>
              </MenuList>
            </Portal>
          </>
        )}
      </Menu>
    </Flex>
  );
}
