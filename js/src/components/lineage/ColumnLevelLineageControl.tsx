import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Flex,
  Text,
  IconButton,
  Code,
  Icon,
  Link,
  Popover,
  Button,
  Portal,
  Box,
} from "@chakra-ui/react";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { FaRegDotCircle } from "react-icons/fa";
import { useState } from "react";
import { PiInfo, PiX } from "react-icons/pi";

const AnalyzeChangeHint = ({ ml }: { ml?: number }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Popover.Root
      open={hovered}
      onFocusOutside={() => {
        setHovered(false);
      }}
      positioning={{ placement: "bottom-start" }}
      lazyMount
      unmountOnExit>
      <Popover.Trigger asChild>
        <Icon
          boxSize="10px"
          as={PiInfo}
          cursor="pointer"
          ml={ml}
          onMouseEnter={() => {
            setHovered(true);
          }}
        />
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content bg="black" color="white">
            <Popover.Arrow />
            <Popover.Body fontSize="sm">
              Breaking changes are determined by analyzing SQL for changes that may impact
              downstream models.{" "}
              <Link
                href="https://docs.datarecce.io/features/breaking-change-analysis/"
                target="_blank"
                textDecoration="underline">
                Learn more
              </Link>
              .
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

const CllHint = () => {
  const [hovered, setHovered] = useState(false);

  return (
    <Popover.Root
      open={hovered}
      onFocusOutside={() => {
        setHovered(false);
      }}
      positioning={{ placement: "bottom-start" }}
      lazyMount
      unmountOnExit>
      <Popover.Trigger asChild>
        <Icon
          boxSize="10px"
          as={PiInfo}
          color="white"
          cursor="pointer"
          ml="1"
          onMouseEnter={() => {
            setHovered(true);
          }}
        />
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content bg="black" color="white">
            <Popover.Arrow />
            <Popover.Body fontSize="sm">
              Column-Level Lineage provides visibility into the upstream and downstream
              relationships of a column.{" "}
              <Link
                href="https://docs.datarecce.io/features/column-level-lineage/"
                target="_blank"
                textDecoration="underline">
                Learn more
              </Link>
              .
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
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
        <Box borderRadius="md" boxShadow="md" border="1px solid" borderColor="gray.200" bg="white">
          <Button
            size="sm"
            variant="ghost"
            whiteSpace="nowrap"
            display="inline-flex"
            disabled={!interactive}
            onClick={() => {
              void showColumnLevelLineage({ no_upstream: true, change_analysis: true });
            }}>
            <FaRegDotCircle /> Impact Radius
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
          fontSize="0.8rem"
          p="0 0.625rem"
          alignItems="center">
          <ModeMessage />
          <IconButton
            variant="ghost"
            size="xs"
            ml="2"
            aria-label="Reset Column Level Lineage"
            onClick={() => {
              void resetColumnLevelLineage();
            }}>
            <PiX size="10px" />
          </IconButton>
        </Flex>
      )}
    </Flex>
  );
};
