import {
  Button,
  CloseButton,
  Dialog,
  Flex,
  Heading,
  Icon,
  IconButton,
  Link,
  List,
  Portal,
  Separator,
  Table,
  useDisclosure,
} from "@chakra-ui/react";
import { format, formatDistance, parseISO } from "date-fns";
import { isEmpty } from "lodash";
import React from "react";
import { LuExternalLink } from "react-icons/lu";
import { LineageGraph } from "@/components/lineage/lineage";
import { Tooltip } from "@/components/ui/tooltip";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { IconInfo } from "../icons";

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

export function extractSchemas(
  lineageGraph: LineageGraph | undefined,
): [Set<string>, Set<string>] {
  const baseSchemas = new Set<string>();
  const currentSchemas = new Set<string>();

  if (lineageGraph?.nodes) {
    for (const value of Object.values(lineageGraph.nodes)) {
      if (value.data.data.base?.schema) {
        baseSchemas.add(value.data.data.base.schema);
      }
      if (value.data.data.current?.schema) {
        currentSchemas.add(value.data.data.current.schema);
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
    .filter(
      ([key, value]) => key !== "url" && value !== null && value !== undefined,
    )
    .map(([key, value]) => (
      <List.Item key={key} ml="10px">
        {key}: {value}
      </List.Item>
    ));
}

export function EnvInfo() {
  const { envInfo, reviewMode, lineageGraph } = useLineageGraphContext();
  const { open, onOpen, onClose } = useDisclosure();
  const git = envInfo?.git;
  const pr = envInfo?.pullRequest;
  const reviewInfo = { ...git, ...pr };

  const dbtBase = envInfo?.dbt?.base;
  const dbtCurrent = envInfo?.dbt?.current;

  const baseTime = dbtBase?.generated_at
    ? formatTimestamp(dbtBase.generated_at)
    : "";
  const currentTime = dbtCurrent?.generated_at
    ? formatTimestamp(dbtCurrent.generated_at)
    : "";
  let baseRelativeTime = "";
  let currentRelativeTime = "";
  if (dbtBase) {
    baseRelativeTime = dbtBase.generated_at
      ? formatTimeToNow(dbtBase.generated_at)
      : "";
  }
  if (dbtCurrent) {
    currentRelativeTime = dbtCurrent.generated_at
      ? formatTimeToNow(dbtCurrent.generated_at)
      : "";
  }
  const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

  return (
    <>
      <Tooltip
        content="Environment Info"
        positioning={{ placement: "bottom-end" }}
      >
        <div
          className="flex items-center hover:cursor-pointer hover:text-black"
          onClick={onOpen}
        >
          <div className="hidden text-sm lg:flex lg:flex-col">
            <div className="flex gap-1">
              <span className="no-track-pii-safe max-w-32 truncate">
                {Array.from(baseSchemas).join(", ")}
              </span>{" "}
              ({baseRelativeTime})
            </div>
            <div className="flex gap-1">
              <span className="no-track-pii-safe max-w-32 truncate">
                {Array.from(currentSchemas).join(", ")}
              </span>{" "}
              ({currentRelativeTime})
            </div>
          </div>
          <IconButton size="sm" variant="plain" aria-label="Environment Info">
            <Icon verticalAlign="middle" as={IconInfo} boxSize={"16px"} />
          </IconButton>
        </div>
      </Tooltip>
      <Dialog.Root open={open} onOpenChange={onClose} size="lg">
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Environment Information</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Flex direction="column" gap="5px">
                  {reviewMode ? (
                    <>
                      <Flex justifyContent="left" gap="5px" direction="column">
                        <Heading size="sm">Review Information</Heading>
                        <List.Root>
                          {reviewInfo.url && (
                            <List.Item ml="10px">
                              url:{" "}
                              <Link
                                href={reviewInfo.url}
                                color="blue.500"
                                target="_blank"
                              >
                                {reviewInfo.url} <LuExternalLink />
                              </Link>
                            </List.Item>
                          )}
                          {!isEmpty(reviewInfo) &&
                            renderInfoEntries(reviewInfo)}
                        </List.Root>
                      </Flex>
                    </>
                  ) : (
                    <>
                      <Flex justifyContent="left" gap="5px" direction="column">
                        <Heading size="sm">Dev Information</Heading>
                        <List.Root>{git && renderInfoEntries(git)}</List.Root>
                      </Flex>
                    </>
                  )}
                  <Separator />
                  {envInfo?.adapterType === "dbt" && (
                    <Flex justifyContent="left" gap="5px" direction="column">
                      <Heading size="sm">DBT</Heading>
                      <Table.ScrollArea borderWidth="1px" height="30rem">
                        <Table.Root size="sm" variant="line" stickyHeader>
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader></Table.ColumnHeader>
                              <Table.ColumnHeader>base</Table.ColumnHeader>
                              <Table.ColumnHeader>current</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            <Table.Row>
                              <Table.Cell>schema</Table.Cell>
                              <Table.Cell className="no-track-pii-safe">
                                {Array.from(baseSchemas).map((item) => (
                                  <Tooltip
                                    key={item}
                                    content={item}
                                    positioning={{ placement: "bottom" }}
                                  >
                                    <div className="max-w-72 truncate">
                                      {item}
                                    </div>
                                  </Tooltip>
                                ))}
                              </Table.Cell>
                              <Table.Cell className="no-track-pii-safe">
                                {Array.from(currentSchemas).map((item) => (
                                  <Tooltip
                                    key={item}
                                    content={item}
                                    positioning={{ placement: "bottom" }}
                                  >
                                    <div className="max-w-72 truncate">
                                      {item}
                                    </div>
                                  </Tooltip>
                                ))}
                              </Table.Cell>
                            </Table.Row>
                            <Table.Row>
                              <Table.Cell>version</Table.Cell>
                              <Table.Cell>{dbtBase?.dbt_version}</Table.Cell>
                              <Table.Cell>{dbtCurrent?.dbt_version}</Table.Cell>
                            </Table.Row>
                            <Table.Row>
                              <Table.Cell>timestamp</Table.Cell>
                              <Table.Cell>{baseTime}</Table.Cell>
                              <Table.Cell>{currentTime}</Table.Cell>
                            </Table.Row>
                          </Table.Body>
                        </Table.Root>
                      </Table.ScrollArea>
                    </Flex>
                  )}
                  {envInfo?.adapterType === "sqlmesh" && (
                    <Flex justifyContent="left" gap="5px" direction="column">
                      <Heading size="sm">SQLMesh</Heading>
                      <Table.ScrollArea borderWidth="1px" height="30rem">
                        <Table.Root variant="line" stickyHeader>
                          <Table.Header>
                            <Table.Row>
                              <Table.ColumnHeader></Table.ColumnHeader>
                              <Table.ColumnHeader>base</Table.ColumnHeader>
                              <Table.ColumnHeader>current</Table.ColumnHeader>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            <Table.Row>
                              <Table.Cell>Environment</Table.Cell>
                              <Table.Cell className="no-track-pii-safe">
                                {envInfo.sqlmesh?.base_env}
                              </Table.Cell>
                              <Table.Cell className="no-track-pii-safe">
                                {envInfo.sqlmesh?.current_env}
                              </Table.Cell>
                            </Table.Row>
                          </Table.Body>
                        </Table.Root>
                      </Table.ScrollArea>
                    </Flex>
                  )}
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button colorPalette="blue" mr={3} onClick={onClose}>
                  Close
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
