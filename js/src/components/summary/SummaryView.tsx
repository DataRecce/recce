import { Divider, Flex, Heading, Spacer, Text } from "@chakra-ui/react";
import { useLineageGraphsContext } from "@/lib/hooks/LineageGraphContext";
import { ChangeSummary } from "./ChangeSummary";
import { SchemaSummary } from "./SchemaSummary";

export default function SummaryView() {
  const { lineageGraphSets } = useLineageGraphsContext();
  return (
    <>
      <Flex direction="column" w={'100%'} minHeight="650px">
        <Flex w={'100%'} paddingBottom="10px" marginBottom="20px">
          <Heading fontSize={24}>Change Summary</Heading>
        </Flex>
        {lineageGraphSets &&<>
          <ChangeSummary lineageGraphSets={lineageGraphSets}/>
          <Divider />
          <SchemaSummary lineageGraphSets={lineageGraphSets}/>
        </>
        }
      </Flex>
    </>
  );
}
