import React from "react";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Button,
  Divider,
  Flex,
  Heading,
  Icon,
  IconButton,
  Link,
  ListItem,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tooltip,
  Tr,
  UnorderedList,
  useDisclosure,
} from "@chakra-ui/react";
import { format, formatDistance, parseISO } from "date-fns";
import { IconInfo } from "../icons";
import { isEmpty } from "lodash";
import { LineageGraph } from "@/components/lineage/lineage";

export function formatTimestamp(timestamp: string): string {
  const date = parseISO(timestamp);
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

export function formatTimeToNow(timestamp: string): string {
  const date = parseISO(timestamp);
  return formatDistance(date, new Date(), {
    addSuffix: true,
  });
}

export function extractSchemas(lineageGraph: LineageGraph | undefined): [Set<string>, Set<string>] {
  const baseSchemas = new Set<string>();
  const currentSchemas = new Set<string>();

  if (lineageGraph?.nodes) {
    for (const value of Object.values(lineageGraph.nodes)) {
      if (value.data.base?.schema) {
        baseSchemas.add(value.data.base.schema);
      }
      if (value.data.current?.schema) {
        currentSchemas.add(value.data.current.schema);
      }
    }
  }
  return [baseSchemas, currentSchemas];
}

function renderInfoEntries(info: object): React.JSX.Element[] {
  if (Object.values(info).every((value) => value === null)) {
    return [
      <Flex key={"no info"} ml="10px">
        No information
      </Flex>,
    ];
  }

  return Object.entries(info)
    .filter(([key, value]) => key !== "url" && value !== null && value !== undefined)
    .map(([key, value]) => (
      <ListItem key={key} ml="10px">
        {key}: {value}
      </ListItem>
    ));
}

export function EnvInfo() {
  const { envInfo, reviewMode, lineageGraph } = useLineageGraphContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const git = envInfo?.git;
  const pr = envInfo?.pullRequest;
  const reviewInfo = { ...git, ...pr };

  const dbtBase = envInfo?.dbt?.base;
  const dbtCurrent = envInfo?.dbt?.current;

  const baseTime = dbtBase?.generated_at ? formatTimestamp(dbtBase.generated_at) : "";
  const currentTime = dbtCurrent?.generated_at ? formatTimestamp(dbtCurrent.generated_at) : "";
  let baseRelativeTime = "";
  let currentRelativeTime = "";
  if (dbtBase) {
    baseRelativeTime = dbtBase.generated_at ? formatTimeToNow(dbtBase.generated_at) : "";
  }
  if (dbtCurrent) {
    currentRelativeTime = dbtCurrent.generated_at ? formatTimeToNow(dbtCurrent.generated_at) : "";
  }
  const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

  return (
    <>
      <Tooltip label="Environment Info" placement="bottom-end">
        <div className="flex items-center hover:cursor-pointer hover:text-black" onClick={onOpen}>
          <div className="hidden text-sm lg:flex lg:flex-col">
            <div className="flex gap-1">
              <span className="no-track-pii-safe max-w-32 truncate">
                {Array.from(baseSchemas).join(", ")}
              </span>{" "}
              ({baseRelativeTime})
            </div>
            <div className="flex gap-1">
              <div className="no-track-pii-safe max-w-32 truncate">
                {Array.from(currentSchemas).join(", ")}
              </div>{" "}
              ({currentRelativeTime})
            </div>
          </div>
          <IconButton
            size="sm"
            variant="unstyled"
            aria-label="Environment Info"
            icon={<Icon verticalAlign="middle" as={IconInfo} boxSize={"16px"} />}
          />
        </div>
      </Tooltip>
      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Environment Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex direction="column" gap="5px">
              {reviewMode ? (
                <>
                  <Flex justifyContent="left" gap="5px" direction="column">
                    <Heading size="sm">Review Information</Heading>
                    <UnorderedList spacing={1}>
                      {reviewInfo.url && (
                        <ListItem ml="10px">
                          url:{" "}
                          <Link href={reviewInfo.url} color="blue.500" isExternal>
                            {reviewInfo.url}
                          </Link>
                        </ListItem>
                      )}
                      {!isEmpty(reviewInfo) && renderInfoEntries(reviewInfo)}
                    </UnorderedList>
                  </Flex>
                </>
              ) : (
                <>
                  <Flex justifyContent="left" gap="5px" direction="column">
                    <Heading size="sm">Dev Information</Heading>
                    <UnorderedList spacing={1}>{git && renderInfoEntries(git)}</UnorderedList>
                  </Flex>
                </>
              )}
              <Divider />
              {envInfo?.adapterType === "dbt" && (
                <Flex justifyContent="left" gap="5px" direction="column">
                  <Heading size="sm">DBT</Heading>
                  <TableContainer>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th></Th>
                          <Th>base</Th>
                          <Th>current</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        <Tr>
                          <Td>schema</Td>
                          <Td className="no-track-pii-safe">
                            {Array.from(baseSchemas).map((item) => (
                              <Tooltip key={item} label={item} placement="bottom">
                                <div className="max-w-72 truncate">{item}</div>
                              </Tooltip>
                            ))}
                          </Td>
                          <Td className="no-track-pii-safe">
                            {Array.from(currentSchemas).map((item) => (
                              <Tooltip key={item} label={item} placement="bottom">
                                <div className="max-w-72 truncate">{item}</div>
                              </Tooltip>
                            ))}
                          </Td>
                        </Tr>
                        <Tr>
                          <Td>version</Td>
                          <Td>{dbtBase?.dbt_version}</Td>
                          <Td>{dbtCurrent?.dbt_version}</Td>
                        </Tr>
                        <Tr>
                          <Td>timestamp</Td>
                          <Td>{baseTime}</Td>
                          <Td>{currentTime}</Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Flex>
              )}
              {envInfo?.adapterType === "sqlmesh" && (
                <Flex justifyContent="left" gap="5px" direction="column">
                  <Heading size="sm">SQLMesh</Heading>
                  <TableContainer>
                    <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th></Th>
                          <Th>base</Th>
                          <Th>current</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        <Tr>
                          <Td>Environment</Td>
                          <Td className="no-track-pii-safe">{envInfo.sqlmesh?.base_env}</Td>
                          <Td className="no-track-pii-safe">{envInfo.sqlmesh?.current_env}</Td>
                        </Tr>
                      </Tbody>
                    </Table>
                  </TableContainer>
                </Flex>
              )}
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
