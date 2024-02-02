import { SmallCloseIcon } from "@chakra-ui/icons";
import { Box, Button, ButtonGroup, HStack, Icon, IconButton, SlideFade, StackDivider } from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { FetchSelectedNodesRowCountButton } from "./NodeTag";
import { MdOutlineSchema } from "react-icons/md";
import { createCheckByNodeSchema, createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";
import { FiAlignLeft } from "react-icons/fi";
import { useRowCountQueries } from "@/lib/api/models";

export interface NodeSelectorProps {
  nodes: LineageGraphNode[];
  isOpen: boolean;
  onClose: () => void;
}

function AddSchemaChangesCheckButton({ nodes, onFinish }: { nodes: LineageGraphNode[], onFinish: () => void }) {
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
          await Promise.all(nodes.map(async (node) => {
            await createCheckByNodeSchema(node.id);
          }));
        }
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}>
      <Icon as={MdOutlineSchema} />
      Add schema check
    </Button>
  );
}

function AddRowCountCheckButton({ nodes, onFinish }: { nodes: LineageGraphNode[], onFinish: () => void }) {
  const [, setLocation] = useLocation();
  const { isLoading, fetchFn: fetchRowCountFn } = useRowCountQueries(nodes.map((node) => node.name));

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

export function NodeSelector({ nodes, isOpen, onClose }: NodeSelectorProps) {
  function countSelectedNodes(nodes: LineageGraphNode[]) {
    return nodes.filter((node) => node.isSelected).length;
  }
  const selectedNodes = nodes.filter((node) => node.isSelected);
  return (<>
    <SlideFade in={isOpen} style={{ zIndex: 10 }}>
      <Box
        bg="white"
        rounded="md"
        shadow="dark-lg"
      >
        <HStack
        p="5px 15px"
        mt="4"
        divider={<StackDivider borderColor='gray.200' />}
        spacing={4}
        >
          <ButtonGroup size="xs" isAttached variant='outline' rounded="xs" onClick={onClose}>
            <Button >{countSelectedNodes(nodes)} selected</Button>
            <IconButton aria-label='Exit select Mode' icon={<SmallCloseIcon />} />
          </ButtonGroup>
          <HStack>
            <FetchSelectedNodesRowCountButton
              selectedNodes={selectedNodes.length > 0 ? selectedNodes: []}
              onFinish={onClose}
            />
            <AddSchemaChangesCheckButton
              nodes={selectedNodes.length > 0 ? selectedNodes: []}
              onFinish={onClose}
            />
            <AddRowCountCheckButton
              nodes={selectedNodes.length > 0 ? selectedNodes: []}
              onFinish={onClose}
            />
          </HStack>
        </HStack>
      </Box>
    </SlideFade>
  </>);
}
