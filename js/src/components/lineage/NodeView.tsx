import {
  Box,
  CloseButton,
  Flex,
  Grid,
  Heading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  HStack,
  Button,
  Spacer,
  SkeletonText,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Tooltip,
  Tag,
  TagLeftIcon,
  TagLabel,
  Icon,
  IconButton,
} from "@chakra-ui/react";

import { FaCode } from "react-icons/fa";
import { FiAlignLeft, FiTrendingUp, FiTrendingDown, FiFrown } from "react-icons/fi";
import { MdQueryStats } from "react-icons/md";
import { LineageGraphNode } from "./lineage";
import { SchemaView } from "../schema/SchemaView";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { SqlDiffView } from "../schema/SqlDiffView";
import useMismatchSummaryModal from "./MismatchSummary";
import { useLocation } from "wouter";
import { getIconForResourceType } from "./styles";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { fetchModelRowCount } from "@/lib/api/models";


interface ModelRowCount {
  base: number | null;
  curr: number | null;
}

interface ModelRowCountProps {
  rowCount?: ModelRowCount;
}

export function ModelRowCount({ rowCount }: ModelRowCountProps ) {
  if (!rowCount) {
    return (
      <HStack>
        <Text>Failed to load</Text>
        <Icon as={FiFrown} color="red.500" />
      </HStack>
    )
  }
  const base = rowCount.base === null ? -1 : rowCount.base;
  const current = rowCount.curr === null ? -1 : rowCount.curr;
  const baseLabel = base === -1 ? "N/A" : base;
  const currentLabel = current === -1 ? "N/A" : current;


  if (base === current) {
    return <Text>{base}</Text>;
  } else if (base < current) {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingUp} color="green.500" />
        <Text>{currentLabel}</Text>
      </HStack>
    );
  } else {
    return (
      <HStack>
        <Text>{baseLabel}</Text>
        <Icon as={FiTrendingDown} color="red.500" />
        <Text>{currentLabel}</Text>
      </HStack>
    );
  }
}

interface NodeViewProps {
  node: LineageGraphNode;
  onCloseNode: () => void;
}

export function NodeView({ node, onCloseNode }: NodeViewProps) {
  const [ ,setLocation] = useLocation();
  const { setSqlQuery } = useRecceQueryContext();
  const withColumns =
    node.resourceType === "model" ||
    node.resourceType === "seed" ||
    node.resourceType === "source";
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { MismatchSummaryModal } = useMismatchSummaryModal();
  const { icon: resourceTypeIcon } = getIconForResourceType(node.resourceType);
  const { isLoading, data: rowCount, refetch: invokeRowCountQuery , isFetched, isFetching } = useQuery({
    queryKey: cacheKeys.rowCount(node.name),
    queryFn:  () => fetchModelRowCount(node.name),
    enabled: false,
  });

  return (
    <Grid height="100%" templateRows="auto auto 1fr">
      <HStack>
        <Box flex="0 1 20%" p="16px">
          <Heading size="sm">{node.name}</Heading>
        </Box>
        <Spacer />
        {node.changeStatus === "modified" && (
          <Box>
            <Button
              onClick={onOpen}
              leftIcon={<FaCode />}
              colorScheme="orange"
              variant="solid"
            >
              Diff
            </Button>
            <Modal isOpen={isOpen} onClose={onClose} size="6xl">
              <ModalOverlay />
              <ModalContent overflowY="auto" height="75%">
                <ModalHeader>Model Raw Code Diff</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                  <SqlDiffView
                    base={node.data.base}
                    current={node.data.current}
                  />
                </ModalBody>
              </ModalContent>
            </Modal>
          </Box>
        )}
        <Box flex="0 1 1%" p="16px">
          <CloseButton onClick={onCloseNode} />
        </Box>
      </HStack>
      <Box
        color="gray"
        paddingLeft={"16px"}
      >
        <HStack spacing={"8px"}>
          <Tooltip hasArrow label="Type of resource">
            <Tag>
              <TagLeftIcon as={resourceTypeIcon} />
              <TagLabel>{node.resourceType}</TagLabel>
            </Tag>
          </Tooltip>
          {node.resourceType === "model" && (
            <Tooltip hasArrow label={isFetched || isFetching?"Number of row":"Query the number of row"}>
              <Tag>
                <TagLeftIcon as={FiAlignLeft} />
                {isFetched || isFetching ? (
                  <TagLabel>
                    <SkeletonText isLoaded={!isLoading} noOfLines={1} skeletonHeight={2} minWidth={'30px'}>
                      <ModelRowCount rowCount={rowCount} />
                    </SkeletonText>
                  </TagLabel>
                ) :
                  <IconButton
                    aria-label="Query Row Count"
                    icon={<MdQueryStats />}
                    size="xs"
                    onClick={() => {
                      invokeRowCountQuery()
                    }}
                    />
                }
              </Tag>

            </Tooltip>
          )}
        </HStack>
      </Box>
      {withColumns && (
        <Tabs overflow="auto" as={Flex}>
          <TabList>
            <Tab>Columns</Tab>
          </TabList>
          <TabPanels overflow="auto" height="calc(100% - 42px)">
            <TabPanel p={0} overflowY="auto" height="100%">
              <SchemaView base={node.data.base} current={node.data.current} />
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
      {node.resourceType === "model" && node.changeStatus === "modified" && (
        <HStack p="16px">
          <Spacer />
          <MismatchSummaryModal node={node} />
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => {
              setSqlQuery(`select * from {{ ref("${node.name}") }}`);
              setLocation("/query");
            }}
          >
            Query
          </Button>
        </HStack>
      )}
    </Grid>
  );
}
