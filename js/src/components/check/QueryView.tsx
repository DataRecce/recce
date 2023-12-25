import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
} from "@chakra-ui/react";
import SqlEditor from "@/components/query/SqlEditor";
import { QueryDiffDataGrid } from "@/components/query/QueryDiffDataGrid";
import { QueryDiffResult, QueryResult } from "@/lib/api/adhocQuery";
import { Check } from "@/lib/api/checks";
import { QueryDataGrid } from "../query/QueryDataGrid";

interface QueryViewProp {
  check: Check;
}

export function QueryView({ check }: QueryViewProp) {
  return (
    <>
      <Accordion defaultIndex={[]} allowToggle>
        {check?.type === "query_diff" && (
          <AccordionItem>
            <AccordionButton>
              query
              <AccordionIcon />
            </AccordionButton>

            <AccordionPanel>
              <Box height="400px" width="100%" border="lightgray 1px solid ">
                <SqlEditor
                  value={(check?.params as any)?.sql_template || ""}
                  options={{ readOnly: true }}
                />
              </Box>
            </AccordionPanel>
          </AccordionItem>
        )}
      </Accordion>

      <Box flex="1" style={{ contain: "size" }}>
        {check?.type === "query" && (
          <QueryDataGrid
            isFetching={false}
            result={check?.last_run?.result as QueryResult}
          />
        )}
      </Box>
    </>
  );
}
