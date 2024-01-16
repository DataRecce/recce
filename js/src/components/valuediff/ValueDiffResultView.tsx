import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Code,
} from "@chakra-ui/react";

import { Check } from "@/lib/api/checks";
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";
import {
  ValueDiffError,
  ValueDiffParams,
  ValueDiffResult,
} from "@/lib/api/valuediff";
import { ScreenshotBox } from "../screenshot/ScreenshotBox";
import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { Run } from "@/lib/api/types";

interface ValueDiffResultViewProp {
  run: Run;
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
      return (
        <>
          <Box flex="1" textAlign="left">
            <Alert status="error" rounded={5} flexDirection="column">
              <AlertIcon boxSize="40px" />
              <AlertTitle fontSize="lg" mr={2}>
                Can not execute value-diff
              </AlertTitle>
              <AlertDescription>{error.sql}</AlertDescription>
            </Alert>
          </Box>
        </>
      );
    }

    return (
      <AccordionItem>
        <AccordionButton>
          <Box flex="1" textAlign="left">
            <Alert status="error" rounded={5}>
              <AlertIcon />
              <AlertTitle fontSize="sm" mr={2}>
                Test column [{error.column_name}] {error.test} failed on{" "}
                {error.base ? "base" : "current"}
              </AlertTitle>
            </Alert>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={4}>
          <Box>
            <Box>There are invalid data. You can check it with this query:</Box>
            <Code m={2} p={1}>
              {error.sql}
            </Code>
          </Box>
        </AccordionPanel>
      </AccordionItem>
    );
  };

  return (
    <>
      <Accordion allowToggle mt={5} mb={5}>
        {errors.map((e) => (
          <ErrorEntry key={`${e.base}_${e.test}_${e.column_name}`} error={e} />
        ))}
      </Accordion>
    </>
  );
}
export function ValueDiffResultView({ run }: ValueDiffResultViewProp) {
  const result = run.result as ValueDiffResult;
  const params = run.params as ValueDiffParams;

  const columns = result.data.schema.fields.map((field: { name: string }) => {
    return { name: field.name, key: field.name };
  });

  return (
    <>
      <Box p={5}>
        <>
          <Box mb={1}>
            Model: <b>{params.model}</b>, Primary Key:{" "}
            <b>{params.primary_key}</b>
          </Box>
          <Box mb={1}>
            {result.summary.total} rows ({result.summary.added} added,{" "}
            {result.summary.removed} removed)
          </Box>
          {/* <ValueDiffErrorHints errors={valueDiffSummary.errors} /> */}

          <ScreenshotDataGrid
            style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
            columns={columns.map((column: any) => ({
              ...column,
              width: undefined,
              resizable: true,
              flexGrow: 1,
            }))}
            rows={result.data.data}
            defaultColumnOptions={{ resizable: true }}
            className="rdg-light"
            enableScreenshot={true}
          />
        </>
      </Box>
    </>
  );
}
