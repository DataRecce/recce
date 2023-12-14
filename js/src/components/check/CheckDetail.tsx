import { useCheck } from "@/lib/api/checks";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Center,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spacer,
  Textarea,
} from "@chakra-ui/react";
import SqlEditor from "../query/SqlEditor";
import { QueryDiffDataGrid } from "../query/QueryDiffDataGrid";
import { useEffect, useState } from "react";

interface CheckDetailProps {
  checkId: string;
}

import { DeleteIcon } from "@chakra-ui/icons";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscKebabVertical } from "react-icons/vsc";

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const { isLoading, error, data: check } = useCheck(checkId);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [name, setName] = useState<string>();
  useEffect(() => {
    setName(check?.name);
    setPrimaryKeys([]);
  }, [check?.name]);

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  return (
    <Flex height="100%" width="100%" maxHeight="100%" direction="column">
      <Flex p="8px 16px" alignItems="center">
        <CheckBreadcrumb name={name || ""} setName={setName} />
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<Icon as={VscKebabVertical} />}
            variant="ghost"
          />
          <MenuList>
            <MenuItem icon={<DeleteIcon />}>Delete</MenuItem>
          </MenuList>
        </Menu>
        <Spacer />
        <Checkbox>Check</Checkbox>
      </Flex>

      <Accordion defaultIndex={[]} allowToggle>
        <AccordionItem>
          <AccordionButton>
            <Box as="span" textAlign="left">
              description
            </Box>
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel pb={4}>
            <Textarea width="100%" height="400px"></Textarea>
          </AccordionPanel>
        </AccordionItem>

        <AccordionItem>
          <AccordionButton>
            query
            <AccordionIcon />
          </AccordionButton>

          <AccordionPanel>
            <Box height="400px" width="100%" border="lightgray 1px solid ">
              <SqlEditor value={(check?.params as any).sql_template} />
            </Box>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <Box flex="1" style={{ contain: "size" }}>
        <QueryDiffDataGrid
          isFetching={false}
          result={check?.last_run?.result}
          primaryKeys={primaryKeys}
          setPrimaryKeys={setPrimaryKeys}
        />
      </Box>
    </Flex>
  );
};
