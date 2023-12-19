import React, { useEffect, useState } from "react";
import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Progress,
  Select,
  useDisclosure,
} from "@chakra-ui/react";
import { LineageGraphNode, NodeData } from "./lineage";
import { axiosClient } from "@/lib/api/axiosClient";
import { ValueDiffPanel, ValueDiffSummary } from "@/components/check/ValueDiffView";
import { useLocation } from "wouter";


interface MismatchSummaryProp {
  node: LineageGraphNode;
}


function extractColumnNames(node: LineageGraphNode) {
  function getNames(nodeData: NodeData) {
    return nodeData && nodeData.columns ? Object.values(nodeData.columns).map(column => column.name) : [];
  }

  const baseColumns = getNames(node.data.base!!);
  const currentColumns = getNames(node.data.current!!);

  // keep the columns order
  const union: string[] = [];
  baseColumns.forEach(column => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });
  currentColumns.forEach(column => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });

  return union;
}


async function fetchColumnValuesComparison(model: string, primaryKey: string) {
  try {
    const data = {
      type: "value_diff",
      params: {
        model: model,
        primary_key: primaryKey,
      },
    };
    const response = await axiosClient.post("/api/runs", data);
    return response.data;
  } catch (error) {
    console.error("Error fetching column values comparison:", error);
  }
}

async function handleAddToCheck(valueDiff: ValueDiffSummary) {
  if (!valueDiff.runId) {
    return null;
  }
  const data = {
    run_id: valueDiff.runId,
  };
  const response = await axiosClient.post("/api/checks", data);
  return response.data.check_id;
}


function useMismatchSummaryModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [mismatchSummary, setMismatchSummary] = useState<ValueDiffSummary | null>(null);

  const MismatchSummaryModal = ({ node }: MismatchSummaryProp) => {

    const withColumns = node.resourceType === "model" || node.resourceType === "seed" || node.resourceType === "source";
    const constNames = extractColumnNames(node);
    const [selectedPrimaryKey, setSelectedPrimaryKey] = useState("");
    const [, setLocation] = useLocation();

    const handleExecute = async () => {
      if (isLoading || selectedPrimaryKey === "") {
        return;
      }

      setIsLoading(true);
      try {
        const data = await fetchColumnValuesComparison(node.name, selectedPrimaryKey);
        const result = data.result;
        const columns = result.data.schema.fields.map((field: { name: string }) => {
          return { "name": field.name, "key": field.name };
        });

        setMismatchSummary({
          columns,
          data: result.data.data,
          summary: result.summary,
          params: { model: node.name, primary_key: selectedPrimaryKey },
          runId: data.run_id,
        });
      } catch (error) {
        console.error("Error fetching column values comparison:", error);
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      if (mismatchSummary?.params?.model != node.name) {
        setMismatchSummary(null);
      }
    }, [node.name]);


    if (!withColumns) {
      return <></>;
    }

    return (
      <>
        <Modal isOpen={isOpen} onClose={onClose} size="6xl">
          <ModalOverlay />
          <ModalContent overflowY="auto" height="75%">
            <ModalHeader>Value Diff Summary</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {isLoading ? (
                <Progress size="xs" isIndeterminate />
              ) : !mismatchSummary ? (
                <>
                  <FormControl>
                    <FormLabel>Pick a primary key</FormLabel>
                    <Select
                      placeholder="Select primary key"
                      value={selectedPrimaryKey}
                      onChange={(e) => setSelectedPrimaryKey(e.target.value)}
                    >
                      {constNames.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </FormControl>
                </>
              ) : (
                <ValueDiffPanel valueDiffSummary={mismatchSummary} />
              )}
            </ModalBody>
            <ModalFooter>
              {mismatchSummary &&
                <>
                  <Button mr={3} colorScheme="blue" onClick={() => {
                    setMismatchSummary(null);
                  }}>Clear</Button>
                  <Button mr={3} colorScheme="blue" onClick={async () => {
                    const checkId = await handleAddToCheck(mismatchSummary);
                    if (checkId) {
                      setLocation(`/checks/${checkId}`);
                    }
                  }}>Add to check</Button>
                </>
              }

              <Button colorScheme="blue" onClick={handleExecute}>Execute</Button>

            </ModalFooter>
          </ModalContent>
        </Modal>
        <Button
          colorScheme="blue"
          size="sm"
          onClick={onOpen}
        >
          Value Diff Summary
        </Button>
      </>
    )
      ;
  };

  return {
    MismatchSummaryModal: MismatchSummaryModal,
  };
}

export default useMismatchSummaryModal;
