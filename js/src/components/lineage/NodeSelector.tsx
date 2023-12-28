import { AddIcon, SmallCloseIcon } from "@chakra-ui/icons";
import { Box, Button, ButtonGroup, Divider, HStack, Icon, IconButton, SlideFade, StackDivider, Text } from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { FetchRowCountsButton } from "./NodeTag";
import { MdOutlineSchema } from "react-icons/md";

export interface NodeSelectorProps {
  nodes: LineageGraphNode[];
  isOpen: boolean;
  onClose: () => void;
}

export function NodeSelector({ nodes, isOpen, onClose }: NodeSelectorProps) {
  function countSelectedNodes(nodes: LineageGraphNode[]) {
    return nodes.filter((node) => node.isSelected).length;
  }
  const selectedNodes = nodes.filter((node) => node.isSelected);
  console.log(selectedNodes.length > 0 ? selectedNodes: nodes);
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
            <FetchRowCountsButton
              nodes={selectedNodes.length > 0 ? selectedNodes: nodes}
            />
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                // TODO: Add schema changes check
                onClose();
                // TODO: Redirect to checks page
              }}
            >
              <Icon as={MdOutlineSchema} />
              Add schema check
            </Button>
          </HStack>
        </HStack>
      </Box>

    </SlideFade>
  </>);
}
