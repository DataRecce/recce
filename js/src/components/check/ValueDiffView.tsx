import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert, AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Code,
} from "@chakra-ui/react";


import { Check } from "@/lib/api/checks";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import { ValueDiffError, ValueDiffResult } from "@/lib/api/valuediff";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

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
  errors: ValueDiffError[];
}


function ValueDiffErrorHints({ errors }: { errors: ValueDiffError[] }) {
  if (!errors) {
    return <></>;
  }
  for (let error of errors) {
    console.log(error);
  }

  const ErrorEntry = ({ error }: { error: ValueDiffError }) => {
    if (error.model === "" && error.column_name === "") {
      return <>
        <Box flex="1" textAlign="left">
          <Alert status="error" rounded={5} flexDirection="column">
            <AlertIcon boxSize="40px" />
            <AlertTitle fontSize="lg" mr={2}>Can not execute value-diff</AlertTitle>
            <AlertDescription>{error.sql}</AlertDescription>
          </Alert>
        </Box>
      </>;
    }

    return <AccordionItem>
      <AccordionButton>
        <Box flex="1" textAlign="left">
          <Alert status="error" rounded={5}>
            <AlertIcon />
            <AlertTitle fontSize="sm" mr={2}>Test column [{error.column_name}] {error.test} failed
              on {error.base ? "base" : "current"}</AlertTitle>
          </Alert>
        </Box>
        <AccordionIcon />
      </AccordionButton>
      <AccordionPanel pb={4}>
        <Box>
          <Box>
            There are invalid data. You can check it with this query:
          </Box>
          <Code m={2} p={1}>{error.sql}</Code>
        </Box>
      </AccordionPanel>
    </AccordionItem>;
  };

  return <>
    <Accordion allowToggle mt={5} mb={5}>
      {errors.map(e => <ErrorEntry key={`${e.base}_${e.test}_${e.column_name}`} error={e} />)}
    </Accordion>
  </>;
}

export function ValueDiffPanel({
  valueDiffSummary,
  enableScreenShot=false
 }: {
  valueDiffSummary: ValueDiffSummary,
  enableScreenShot?: boolean }) {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton();

  return <>
    <Box mb={1}>
      Model: <b>{valueDiffSummary.params.model}</b>, Primary Key: <b>{valueDiffSummary.params.primary_key}</b>
    </Box>
    <Box mb={1}>
      {valueDiffSummary.summary.total} rows
      ({valueDiffSummary.summary.added} added, {valueDiffSummary.summary.removed} removed)
    </Box>
    <ValueDiffErrorHints errors={valueDiffSummary.errors} />

    {valueDiffSummary.errors.length === 0 &&(<Box>
      <DataGrid
        ref={ref}
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
    </Box>)}
    {enableScreenShot && <CopyToClipboardButton imageType="png"/>}
  </>;
}

export function ValueDiffView({ check }: ValueDiffViewProp) {
  const result = check.last_run?.result as ValueDiffResult;
  const params = check.params as ValueDiffParams;


  let summary: ValueDiffSummary | null = null;
  if (result) {
    const columns = result.data.schema.fields.map((field: { name: string }) => {
      return { name: field.name, key: field.name };
    });

    summary = { columns, data: result.data.data, summary: result.summary, params, errors: result.errors };
  }

  return (
    <>
      <Box p={5}>
        {summary && <ValueDiffPanel valueDiffSummary={summary} enableScreenShot={true} />}
      </Box>
    </>
  );
}
