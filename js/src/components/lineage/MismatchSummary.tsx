import React, { useEffect, useState } from "react";
import {
  Box,
  Button, Divider,
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
import DataGrid, { ColumnOrColumnGroup } from "react-data-grid";


interface MismatchSummaryProp {
  node: LineageGraphNode;
}

interface MismatchSummary {
  columns: ColumnOrColumnGroup<any, any>[];
  summary: Record<string, any>;
  model: string;
  data: any;
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
    const response = await axiosClient.post("/api/columns_value_mismatched_summary", {
      model: model,
      primary_key: primaryKey,
      // TODO support exclude_columns later
      // exclude_columns: [...]
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching column values comparison:", error);
  }
}


function useMismatchSummaryModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [mismatchSummary, setMismatchSummary] = useState<MismatchSummary | null>(null);

  const MismatchSummaryModal = ({ node }: MismatchSummaryProp) => {

    const withColumns = node.resourceType === "model" || node.resourceType === "seed" || node.resourceType === "source";
    const constNames = extractColumnNames(node);
    const [selectedPrimaryKey, setSelectedPrimaryKey] = useState("");

    const handleExecute = async () => {
      if (isLoading || selectedPrimaryKey === "") {
        return;
      }

      setIsLoading(true);
      try {
        const data = await fetchColumnValuesComparison(node.name, selectedPrimaryKey);
        const columns = data.data.schema.fields.map((field: { name: string }) => {
          return { "name": field.name, "key": field.name };
        });
        setMismatchSummary({ columns, data: data.data.data, summary: data.summary, model: node.name });
      } catch (error) {
        console.error("Error fetching column values comparison:", error);
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      if (mismatchSummary?.model != node.name) {
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
            <ModalHeader>Mismatched Summary</ModalHeader>
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
                <>
                  <Box mb={1}>
                    {mismatchSummary.summary.total} rows
                    ({mismatchSummary.summary.added} added, {mismatchSummary.summary.removed} removed)
                  </Box>
                  <Divider mb={1} mt={1} />
                  <DataGrid
                    style={{ height: "100%", width: "100%" }}
                    columns={mismatchSummary.columns.map(column => ({
                      ...column,
                      width: undefined,
                      resizable: true,
                      flexGrow: 1,
                    }))}
                    rows={mismatchSummary.data}
                    defaultColumnOptions={{ resizable: true }}
                    className="rdg-light"
                  />
                </>
              )}
            </ModalBody>
            <ModalFooter>
              {mismatchSummary &&
                <Button mr={3} colorScheme="blue" onClick={() => {
                  setMismatchSummary(null);
                }}>Clear</Button>}
              <Button colorScheme="blue" onClick={handleExecute}>Execute</Button>

            </ModalFooter>
          </ModalContent>
        </Modal>
        <Button
          colorScheme="blue"
          size="sm"
          onClick={onOpen}
        >
          Mismatch Summary
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
