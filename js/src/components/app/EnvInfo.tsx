import React from "react";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Tooltip,
  Modal,
  ModalOverlay,
  ModalHeader,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  Button,
  ModalFooter,
  useDisclosure,
  IconButton,
  TableContainer,
  Table,
  Thead,
  Th,
  Tbody,
  Tr,
  Td,
  Icon,
  Flex,
  Heading,
  Divider,
  ListItem,
  UnorderedList,
  Link,
} from "@chakra-ui/react";
import { format, parseISO } from "date-fns";
import { IconInfo } from "../icons";

export function formatTimestamp(timestamp: string): string {
  const date = parseISO(timestamp);
  const formattedTimestamp = format(date, "yyyy-MM-dd'T'HH:mm:ss");
  return formattedTimestamp;
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

  return (
    <>
      <Tooltip label="Environment Info" placement="bottom-end">
        <IconButton
          size="sm"
          variant="unstyled"
          aria-label="Export state"
          onClick={onOpen}
          icon={<Icon verticalAlign="middle" as={IconInfo} boxSize={"16px"} />}
        />
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
                      {reviewInfo && renderInfoEntries(reviewInfo)}
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
                          <Td>{JSON.stringify(Array.from(baseSchemas))}</Td>
                          <Td>{JSON.stringify(Array.from(currentSchemas))}</Td>
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
                          <Td>{envInfo.sqlmesh?.base_env}</Td>
                          <Td>{envInfo.sqlmesh?.current_env}</Td>
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
