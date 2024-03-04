import { SmallCloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Icon,
  IconButton,
  SlideFade,
  StackDivider,
  Text,
} from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { FetchSelectedNodesRowCountButton } from "./NodeTag";
import { MdOutlineSchema } from "react-icons/md";
import {
  createCheckByNodeSchema,
  createCheckByRun,
  createLineageDiffCheck,
} from "@/lib/api/checks";
import { useLocation } from "wouter";
import { FiAlignLeft } from "react-icons/fi";
import { useRowCountQueries } from "@/lib/api/models";
import { TbBrandStackshare } from "react-icons/tb";
import { ValueDiffParams } from "@/lib/api/valuediff";
import { RunType } from "@/lib/api/types";
import { GetParamsFn } from "./multi-nodes-runner";
import { on } from "events";

export interface NodeSelectorProps {
  viewMode: string;
  selectMode: "detail" | "action" | "action_result";
  progress?: { completed: number; total: number };
  nodes: LineageGraphNode[];
  onClose: () => void;
  onActionStarted: () => void;
  onActionCompleted: () => void;
  submitRuns: (
    nodes: LineageGraphNode[],
    type: RunType,
    getParams: GetParamsFn
  ) => Promise<void>;
}

function AddSchemaChangesCheckButton({
  nodes,
  onFinish,
}: {
  nodes: LineageGraphNode[];
  onFinish: () => void;
}) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="xs"
      variant="outline"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        // TODO: Add schema changes
        let check;
        if (nodes.length === 1) {
          check = await createCheckByNodeSchema(nodes[0].id);
        } else {
          // TODO: Implement new type of check for multiple schema changes (RC-102)
          await Promise.all(
            nodes.map(async (node) => {
              await createCheckByNodeSchema(node.id);
            })
          );
        }
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}
    >
      <Icon as={MdOutlineSchema} />
      Add schema check
    </Button>
  );
}

function AddRowCountCheckButton({
  nodes,
  onFinish,
}: {
  nodes: LineageGraphNode[];
  onFinish: () => void;
}) {
  const [, setLocation] = useLocation();
  const { isLoading, fetchFn: fetchRowCountFn } = useRowCountQueries(
    nodes.map((node) => node.name)
  );

  return (
    <Button
      size="xs"
      isLoading={isLoading}
      loadingText="Querying"
      variant="outline"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        const runId = await fetchRowCountFn({ skipCache: true });
        const check = await createCheckByRun(runId);
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
        onFinish();
      }}
    >
      <Icon as={FiAlignLeft} />
      Add row count check
    </Button>
  );
}

export function AddLineageDiffCheckButton({
  viewMode,
  nodes,
  onFinish,
  withIcon,
}: {
  viewMode: string;
  nodes: LineageGraphNode[];
  onFinish: () => void;
  withIcon?: boolean;
}) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="xs"
      variant="outline"
      backgroundColor="white"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        const nodeIds = nodes.map((node) => node.id);
        const check = await createLineageDiffCheck(viewMode, nodeIds);
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}
    >
      {withIcon && <Icon as={TbBrandStackshare} />}
      Add lineage diff check
    </Button>
  );
}

export function ValueDiffButton({
  nodes,
  onActionStarted,
  onActionCompleted,
  withIcon,
  submitRuns,
}: {
  nodes: LineageGraphNode[];
  onActionStarted: () => void;
  onActionCompleted: () => void;
  withIcon?: boolean;
  submitRuns: NodeSelectorProps["submitRuns"];
}) {
  const [, setLocation] = useLocation();

  return (
    <Button
      size="xs"
      variant="outline"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        try {
          onActionStarted();
          await submitRuns(nodes, "value_diff", (node) => {
            const primaryKey = node.data?.current?.primary_key;
            if (!primaryKey) {
              return {
                skipReason: "No primary key found",
              };
            }

            const params: Partial<ValueDiffParams> = {
              model: node.name,
              primary_key: primaryKey,
            };

            return { params };
          });
        } finally {
          onActionCompleted();
        }
      }}
    >
      {withIcon && <Icon as={TbBrandStackshare} />}
      Value diff
    </Button>
  );
}

export function NodeSelector({
  viewMode,
  selectMode,
  progress,
  nodes,
  onClose,
  onActionStarted,
  onActionCompleted,
  submitRuns,
}: NodeSelectorProps) {
  function countSelectedNodes(nodes: LineageGraphNode[]) {
    return nodes.filter((node) => node.isSelected).length;
  }
  const selectedNodes = nodes.filter((node) => node.isSelected);
  const isOpen = selectMode === "action" || selectMode === "action_result";

  return (
    <SlideFade in={isOpen} style={{ zIndex: 10 }}>
      <Box bg="white" rounded="md" shadow="dark-lg">
        {selectMode === "action" && (
          <HStack
            p="5px 15px"
            mt="4"
            divider={<StackDivider borderColor="gray.200" />}
            spacing={4}
          >
            <ButtonGroup
              size="xs"
              isAttached
              variant="outline"
              rounded="xs"
              onClick={onClose}
            >
              <Button>{countSelectedNodes(nodes)} selected</Button>
              <IconButton
                aria-label="Exit select Mode"
                icon={<SmallCloseIcon />}
              />
            </ButtonGroup>
            <HStack>
              <FetchSelectedNodesRowCountButton
                nodes={selectedNodes.length > 0 ? selectedNodes : []}
                onFinish={onClose}
              />
              <AddSchemaChangesCheckButton
                nodes={selectedNodes.length > 0 ? selectedNodes : []}
                onFinish={onClose}
              />
              <AddRowCountCheckButton
                nodes={selectedNodes.length > 0 ? selectedNodes : []}
                onFinish={onClose}
              />
              <AddLineageDiffCheckButton
                viewMode={viewMode}
                nodes={selectedNodes.length > 0 ? selectedNodes : []}
                onFinish={onClose}
                withIcon={true}
              />
              <ValueDiffButton
                nodes={selectedNodes.length > 0 ? selectedNodes : []}
                onActionStarted={onActionStarted}
                onActionCompleted={onActionCompleted}
                withIcon={true}
                submitRuns={submitRuns}
              />
            </HStack>
          </HStack>
        )}
        {selectMode === "action_result" && (
          <HStack
            p="5px 15px"
            mt="4"
            divider={<StackDivider borderColor="gray.200" />}
            spacing={4}
          >
            <Box fontSize="10pt">
              Progress: {progress?.completed}/{progress?.total}
            </Box>
            <Button size="xs" variant="outline" onClick={onClose}>
              Close
            </Button>
          </HStack>
        )}
      </Box>
    </SlideFade>
  );
}
