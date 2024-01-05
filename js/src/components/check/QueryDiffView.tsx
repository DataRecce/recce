import { RefObject, useRef, useState } from "react";
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
import { CopyIcon } from "@chakra-ui/icons";
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
  const ref = useRef<HTMLDivElement>();
  const clipboardToast = useToast();
  const [isClipboardHighlight, setClipboardHighlight]  = useState(false)

  const saveToClipboard = async () => {
    const dataUrl = await convertToImage(ref);
    if (!dataUrl) {
      return;
    }
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      console.log('Image copied.');
      clipboardToast({
        description: `Copied the query result as an image to clipboard`,
        status: "info",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error copying image to clipboard', error);
    }
  };

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
        ref={ref as RefObject<HTMLInputElement>}
        flex="1"
        style={{ contain: "size" }}
        shadow={isClipboardHighlight ? "dark-lg" : undefined}
        transition="box-shadow 0.5s ease-in-out"
      >
        {check?.type === "query_diff" && (
          <QueryDiffDataGrid
            run={check?.last_run}
            primaryKeys={(check?.params as QueryDiffResult)?.primary_keys || []}
          />
        )}
      </Box>
      <HStack padding="16px">
        <Spacer />
        <Button
          size="sm"
          leftIcon={<CopyIcon/>}
          onMouseEnter={() => setClipboardHighlight(true)}
          onMouseLeave={() => setClipboardHighlight(false)}
          onClick={saveToClipboard}>
          Copy to Clipboard
        </Button>
      </HStack>
    </>
  );
}
