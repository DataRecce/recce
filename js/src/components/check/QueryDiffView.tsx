import { RefObject, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  HStack,
  Spacer,
  Button,
  useToast,
} from "@chakra-ui/react";
import SqlEditor from "@/components/query/SqlEditor";
import { QueryDiffDataGrid } from "@/components/query/QueryDiffDataGrid";
import { QueryDiffResult } from "@/lib/api/adhocQuery";
import { Check } from "@/lib/api/checks";
import { toPng } from "html-to-image";

interface QueryDiffViewProp {
  check: Check;
}

const convertToImage = async (ref: any) => {
  try {
    const dataUrl = await toPng(ref.current);
    return dataUrl;
  } catch (error) {
    console.error('Error converting to image', error);
  }
};

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

      <Box
        flex="1"
        style={{ contain: "size" }}
        transition="box-shadow 0.5s ease-in-out"
      >
        {check?.type === "query_diff" && (
          <QueryDiffDataGrid
            run={check?.last_run}
            primaryKeys={(check?.params as QueryDiffResult)?.primary_keys || []}
            enableScreenShot={true}
          />
        )}
      </Box>
    </>
  );
}
