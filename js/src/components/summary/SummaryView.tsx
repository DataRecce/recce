import { Flex, Heading, Separator } from "@chakra-ui/react";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { ChangeSummary } from "./ChangeSummary";
import { SchemaSummary } from "./SchemaSummary";

export default function SummaryView() {
  const { lineageGraph } = useLineageGraphContext();
  return (
    <>
      <Flex direction="column" w={"100%"} minHeight="650px">
        <Flex w={"100%"} paddingBottom="10px" marginBottom="20px">
          <Heading fontSize={24}>Change Summary</Heading>
        </Flex>
        {lineageGraph && (
          <>
            <ChangeSummary lineageGraph={lineageGraph} />
            <Separator />
            <SchemaSummary lineageGraph={lineageGraph} />
          </>
        )}
      </Flex>
    </>
  );
}
