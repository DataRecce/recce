import { Check, useCheck } from "@/lib/api/checks";
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Center,
  Grid,
  GridItem,
  Icon,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import { VscChevronRight, VscTriangleRight } from "react-icons/vsc";
import SqlEditor from "../query/SqlEditor";
import { QueryDiffDataGrid } from "../query/QueryDiffDataGrid";

interface CheckDetailProps {
  checkId: string;
}

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const { isLoading, error, data: check } = useCheck(checkId);

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  return (
    <Box height="100%" width="100%" overflow="auto">
      <Box height="50%">
        <Breadcrumb
          p="8px 16px"
          fontSize="12pt"
          height="30px"
          separator={<Icon as={VscChevronRight} color="gray.500" />}
        >
          <BreadcrumbItem>
            <BreadcrumbLink>Checks</BreadcrumbLink>
          </BreadcrumbItem>

          <BreadcrumbItem>
            <BreadcrumbLink>{check?.name}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        <Tabs width="100%" size="sm" height="calc(100% - 60px)">
          <TabList h="40px">
            <Tab>Query</Tab>
            <Tab>Params</Tab>
          </TabList>

          <TabPanels h="100%" overflow="auto">
            <TabPanel
              width="100%"
              maxHeight="100%"
              height="400px"
              overflow="auto"
            >
              <SqlEditor value={(check?.params as any).sql_template} />
            </TabPanel>

            <TabPanel as={Center} height="100%" width="100%">
              Working In Progress 🚧
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>

      <Box backgroundColor="gray.100" width="100%" height="50%" overflow="auto">
        <QueryDiffDataGrid
          isFetching={false}
          result={check?.last_run?.result}
          primaryKeys={[]}
          setPrimaryKeys={() => {}}
        />
      </Box>
    </Box>
  );
};
