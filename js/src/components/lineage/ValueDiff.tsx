import React, { useCallback, useEffect, useState } from "react";
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
  useQuery,
} from "@chakra-ui/react";
import { LineageGraphNode, NodeData } from "./lineage";
import { axiosClient } from "@/lib/api/axiosClient";

import { useLocation } from "wouter";
import { createCheckByRun } from "@/lib/api/checks";
import { ValueDiffResult, submitValueDiff } from "@/lib/api/valuediff";
import { Run } from "@/lib/api/types";
import { waitRun } from "@/lib/api/runs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";

interface ValueDiffModalProp {
  node: LineageGraphNode;
}

function extractColumnNames(node: LineageGraphNode) {
  function getNames(nodeData: NodeData) {
    return nodeData && nodeData.columns
      ? Object.values(nodeData.columns).map((column) => column.name)
      : [];
  }

  const baseColumns = getNames(node.data.base!!);
  const currentColumns = getNames(node.data.current!!);

  // keep the columns order
  const union: string[] = [];
  baseColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });
  currentColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });

  return union;
}

export const ValueDiffModal = ({ node }: ValueDiffModalProp) => {
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";

  const constNames = extractColumnNames(node);
  const [selectedPrimaryKey, setSelectedPrimaryKey] = useState("");
  const [, setLocation] = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [runId, setRunId] = useState<string>();

  const valueDiffFn = async () => {
    const { run_id } = await submitValueDiff(
      { model: node.name, primary_key: selectedPrimaryKey },
      { nowait: true }
    );

    setRunId(run_id);

    return await waitRun(run_id);
  };

  const {
    data: run,
    mutate: runValueDiff,
    error: error,
    isPending,
  } = useMutation({
    mutationFn: valueDiffFn,
    onSuccess: (run) => {
      setSelectedPrimaryKey("");
    },
  });
  const queryClient = useQueryClient();

  const handleAddToChecklist = useCallback(async () => {
    if (!run?.run_id) {
      return;
    }

    const check = await createCheckByRun(run.run_id);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [run?.run_id, run?.type, setLocation, queryClient]);

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
            {isPending ? (
              <Progress size="xs" isIndeterminate />
            ) : !run ? (
              <>
                <FormControl>
                  <FormLabel>Pick a primary key</FormLabel>
                  <Select
                    placeholder="Select primary key"
                    value={selectedPrimaryKey}
                    onChange={(e) => setSelectedPrimaryKey(e.target.value)}
                  >
                    {constNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </>
            ) : (
              <ValueDiffResultView run={run} />
            )}
          </ModalBody>
          <ModalFooter>
            {run && (
              <>
                <Button
                  mr={3}
                  colorScheme="blue"
                  onClick={handleAddToChecklist}
                >
                  Add to checklist
                </Button>
              </>
            )}

            <Button colorScheme="blue" onClick={() => runValueDiff()}>
              Execute
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Button colorScheme="blue" size="sm" onClick={onOpen}>
        Value Diff
      </Button>
    </>
  );
};
