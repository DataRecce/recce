import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
} from "@chakra-ui/react";
import SqlEditor from "@/components/query/SqlEditor";
import { Check } from "@/lib/api/checks";
import { QueryDataGrid } from "../query/QueryResultView";

interface QueryViewProp {
  check: Check;
}

export function QueryView({ check }: QueryViewProp) {
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
        {check?.type === "query" && (
          <QueryDataGrid run={check?.last_run} enableScreenshot={true} />
        )}
      </Box>
    </>
  );
}
