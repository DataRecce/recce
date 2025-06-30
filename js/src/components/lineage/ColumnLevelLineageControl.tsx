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
  Badge,
} from "@chakra-ui/react";
import { useLineageViewContextSafe } from "./LineageViewContext";
import { TbRadar } from "react-icons/tb";
import { CllInput } from "@/lib/api/cll";
import { VscArrowLeft } from "react-icons/vsc";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";

interface ColumnLevelLineageControlProps {
  node?: string;
  column?: string;
  reset: () => void;
}
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
    return "Impact Radius for Changed Models";
  }

  const nodeName =
    cllInput.node_id in lineageGraph.nodes
      ? lineageGraph.nodes[cllInput.node_id].name
      : cllInput.node_id;

  if (!cllInput.column) {
    const nodeId = cllInput.node_id;

    return (
      <>
        <Text as="span">Impact Radius for </Text>
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
        <Text as="span">Column Lineage for </Text>
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
  const { viewOptions, showColumnLevelLineage, resetColumnLevelLineage } =
    useLineageViewContextSafe();
  const { data: flagData } = useRecceServerFlag();
  const singleEnv = flagData?.single_env_onboarding ?? false;

  return (
    <Flex
      minWidth="300px"
      direction="row"
      alignItems="center"
      gap="5px"
      p="5px 10px"
      borderRadius="md"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
      bg="white"
      justifyContent="space-between"
      fontSize={"10pt"}>
      <Menu>
        <MenuButton
          flex="1"
          as={Button}
          size="sm"
          variant="ghost"
          whiteSpace="nowrap"
          display="inline-flex"
          rightIcon={<ChevronDownIcon />}>
          <ModeMessage />
        </MenuButton>
        <MenuList>
          <MenuItem
            onClick={() => {
              void resetColumnLevelLineage();
            }}>
            Default View
          </MenuItem>
          {!singleEnv && (
            <MenuItem
              onClick={() => {
                void showColumnLevelLineage({ no_upstream: true, change_analysis: true });
              }}>
              Impact Radius
            </MenuItem>
          )}
        </MenuList>
      </Menu>

      {/* {viewOptions.column_level_lineage?.change_analysis && (
          <Badge fontSize="8pt" variant="solid" colorScheme="orange" size={"xs"}>
            change analysis
            <AnalyzeChangeHint ml={1} />
          </Badge>
        )}
        {viewOptions.column_level_lineage && !viewOptions.column_level_lineage.no_cll && (
          <Badge fontSize="8pt" variant="solid" colorScheme="yellow" size={"xs"}>
            cll
            <CllHint />
          </Badge>
        )} */}

      <IconButton
        icon={<Icon as={VscArrowLeft} boxSize="10px" />}
        aria-label={""}
        onClick={() => {
          void resetColumnLevelLineage(true);
        }}
        size="xs"
        variant="ghost"
      />
    </Flex>
  );
};
