import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { ChevronDownIcon, CloseIcon, InfoOutlineIcon } from "@chakra-ui/icons";
import {
  Flex,
  Text,
  IconButton,
  Code,
  Icon,
  Link,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Divider,
  Box,
} from "@chakra-ui/react";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { VscArrowLeft } from "react-icons/vsc";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { FaRegDotCircle } from "react-icons/fa";

const AnalyzeChangeHint = ({ ml }: { ml?: number }) => {
  return (
    <Popover trigger="hover" placement="bottom-start" isLazy>
      <PopoverTrigger>
        <Icon boxSize="10px" as={InfoOutlineIcon} cursor="pointer" ml={ml} />
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg="black" color="white">
          <PopoverBody fontSize="sm">
            Breaking changes are determined by analyzing SQL for changes that may impact downstream
            models.{" "}
            <Link
              href="https://docs.datarecce.io/features/breaking-change-analysis/"
              target="_blank"
              textDecoration="underline">
              Learn more
            </Link>
            .
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

const CllHint = () => {
  return (
    <Popover trigger="hover" placement="bottom-start">
      <PopoverTrigger>
        <Icon boxSize="10px" as={InfoOutlineIcon} color="white" cursor="pointer" ml="1" />
      </PopoverTrigger>
      <Portal>
        <PopoverContent bg="black" color="white">
          <PopoverBody fontSize="sm">
            Column-Level Lineage provides visibility into the upstream and downstream relationships
            of a column.{" "}
            <Link
              href="https://docs.datarecce.io/features/column-level-lineage/"
              target="_blank"
              textDecoration="underline">
              Learn more
            </Link>
            .
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

const ModeMessage = () => {
  const { lineageGraph } = useLineageGraphContext();
  const { centerNode, viewOptions, cll } = useLineageViewContextSafe();
  const cllInput = viewOptions.column_level_lineage;

  if (!lineageGraph) {
    return <></>;
  }

  if (!cllInput) {
    return "Default View";
  }

  if (cllInput.node_id === undefined) {
    return <Text as="span">Impact Radius for All Changed Models</Text>;
  }

  const nodeName =
    cllInput.node_id in lineageGraph.nodes
      ? lineageGraph.nodes[cllInput.node_id].name
      : cllInput.node_id;

  if (!cllInput.column) {
    const nodeId = cllInput.node_id;

    return (
      <>
        <Text as="span" mr="5px">
          Impact Radius for
        </Text>
        <Code
          onClick={() => {
            centerNode(nodeId);
          }}
          cursor="pointer">
          {nodeName}
        </Code>
      </>
    );
  } else {
    const nodeId = `${cllInput.node_id}_${cllInput.column}`;
    return (
      <>
        <Text as="span" mr="5px">
          Column Lineage for{" "}
        </Text>
        <Code
          onClick={() => {
            centerNode(nodeId);
          }}
          cursor="pointer">
          {nodeName}.{cllInput.column}
        </Code>
      </>
    );
  }
};

export const ColumnLevelLineageControl = () => {
  const { showColumnLevelLineage, resetColumnLevelLineage, interactive, viewOptions } =
    useLineageViewContextSafe();
  const { data: flagData } = useRecceServerFlag();
  const singleEnv = flagData?.single_env_onboarding ?? false;

  return (
    <Flex direction="row" gap="5px">
      {!singleEnv && (
        <Box
          borderRadius="md"
          boxShadow="md"
          border="1px solid"
          borderColor="gray.200"
          bg="white"
          fontSize={"10pt"}>
          <Button
            leftIcon={<FaRegDotCircle />}
            size="sm"
            variant="ghost"
            whiteSpace="nowrap"
            display="inline-flex"
            isDisabled={!interactive}
            onClick={() => {
              void showColumnLevelLineage({ no_upstream: true, change_analysis: true });
            }}>
            Impact Radius
          </Button>
        </Box>
      )}

      {viewOptions.column_level_lineage && (
        <Flex
          borderRadius="md"
          boxShadow="md"
          border="1px solid"
          borderColor="gray.200"
          bg="white"
          fontSize={"10pt"}
          p="5px 10px"
          alignItems={"center"}>
          <ModeMessage />
          <IconButton
            icon={<CloseIcon boxSize="10px" />}
            variant="ghost"
            size="xs"
            ml="2"
            aria-label={""}
            onClick={() => {
              void resetColumnLevelLineage();
            }}
          />
        </Flex>
      )}
    </Flex>
  );
};
