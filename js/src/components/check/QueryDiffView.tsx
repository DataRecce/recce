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
import { QueryDiffResult } from "@/lib/api/adhocQuery";
import { Check } from "@/lib/api/checks";
import { ScreenshotBox } from "@//components/screenshot/ScreenshotBox";

interface QueryDiffViewProp {
  check: Check;
}

export function QueryDiffView({ check }: QueryDiffViewProp) {
  return (
    <>
      <Accordion defaultIndex={[]} allowToggle>
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
      </Accordion>

      <Box flex="1" style={{ contain: "size" }}>
        {check?.type === "query_diff" && (
          <ScreenshotBox style={{ maxHeight: '100%', overflow: 'auto' }}>
            <QueryDiffDataGrid
              run={check?.last_run}
              primaryKeys={
                (check?.params as QueryDiffResult)?.primary_keys || []
              }
            />
          </ScreenshotBox>
        )}
      </Box>
    </>
  );
}
