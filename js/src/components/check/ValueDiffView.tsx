import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Divider,
  Textarea,
} from "@chakra-ui/react";
import { ValueDiffResult } from "@/lib/api/adhocQuery";
import { Check } from "@/lib/api/checks";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import React from "react";

interface ValueDiffViewProp {
  check: Check;
}

export interface ValueDiffParams {
  model: string;
  primary_key: string;
}


export interface ValueDiffSummary {
  columns: ColumnOrColumnGroup<any, any>[];
  summary: Record<string, any>;
  params: ValueDiffParams;
  data: any;
  runId?: string;
}


export function ValueDiffPanel({ valueDiffSummary }: { valueDiffSummary: ValueDiffSummary }) {
  return <>
    <Box mb={1}>
      Model: <b>{valueDiffSummary.params.model}</b>, Primary Key: <b>{valueDiffSummary.params.primary_key}</b>
    </Box>
    <Box mb={1}>
      {valueDiffSummary.summary.total} rows
      ({valueDiffSummary.summary.added} added, {valueDiffSummary.summary.removed} removed)
    </Box>
    <Divider mb={1} mt={1} />
    <DataGrid
      style={{ height: "100%", width: "100%" }}
      columns={valueDiffSummary.columns.map((column: any) => ({
        ...column,
        width: undefined,
        resizable: true,
        flexGrow: 1,
      }))}
      rows={valueDiffSummary.data}
      defaultColumnOptions={{ resizable: true }}
      className="rdg-light"
    />
  </>;
}

export function ValueDiffView({ check }: ValueDiffViewProp) {
  const result = check.last_run?.result as ValueDiffResult;
  const params = check.params as ValueDiffParams;

  let summary: ValueDiffSummary | null = null;
  if (result) {
    const columns = result.data.schema.fields.map((field: { name: string }) => {
      return { "name": field.name, "key": field.name };
    });
    summary = { columns, data: result.data.data, summary: result.summary, params };
  }


  return <>
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
    </Accordion>

    <Box p={5}>
      {summary && <ValueDiffPanel valueDiffSummary={summary} />}
    </Box>
  </>;

}
