import { NodeData } from "@/lib/api/info";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import {
  Flex,
  Modal,
  ModalContent,
  ModalHeader,
  Image,
  Heading,
  Badge,
  Button,
  ModalCloseButton,
  useDisclosure,
  ModalBody,
  Box,
  Icon,
  Text,
  Spacer,
  Tooltip,
  Link,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
import { VSplit } from "../split/Split";
import { RunResultPane } from "../run/RunResultPane";
import { AiOutlineExperiment } from "react-icons/ai";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import { QueryParams, submitQuery } from "@/lib/api/adhocQuery";
import { DualSqlEditor } from "../query/SqlEditor";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { RiMindMap, RiTerminalBoxLine } from "react-icons/ri";

export function BaseEnvironmentSetupGuide() {
  return (
    <Flex
      flex="1"
      h="100%"
      minH={0}
      m="2"
      p="4"
      bg="blue.50"
      borderRadius="lg"
      boxShadow="md"
      justifyContent={"center"}>
      <Flex w="80%" direction="column" overflowY="auto" gap={6} px={8} pb={8}>
        <Flex direction="column" alignItems={"center"} gap={4}>
          <Flex
            p={2}
            bg="white"
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
            boxShadow="md">
            <Icon as={RiTerminalBoxLine} boxSize={7} color="blue.500" />
          </Flex>
          <Heading mt="4" size="lg">
            Wait, there's more!
          </Heading>
          <Text fontWeight="medium" fontSize="md" textAlign="center">
            Recce is currently running in limited functionality mode, so you can run queries but
            can't diff the results yet!
          </Text>
        </Flex>
        <Flex direction="column" gap={2}>
          <Text fontSize="md">
            To unlock the full power of Recce, set up a base environment of dbt artifacts for
            comparison.
          </Text>
          <Text>Once configured, you'll be able to:</Text>
          <UnorderedList>
            <ListItem>
              <Text>Run statistical data diffs</Text>
            </ListItem>
            <ListItem>
              <Text>Run query diffs</Text>
            </ListItem>
            <ListItem>
              <Text>Save checks to your Recce Checklist</Text>
            </ListItem>
            <ListItem>
              <Text>...and more!</Text>
            </ListItem>
          </UnorderedList>
          <Text fontSize="md">Take the next step toward better data impact assessment.</Text>
        </Flex>
        <Flex w="100%" direction="column" mt={6}>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={() => {
              window.open("https://datarecce.io/docs/get-started/#prepare-dbt-artifacts", "_blank");
            }}>
            Start Now
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}

export function BaseEnvironmentSetupNotification() {
  return (
    <Flex direction="row" gap="10px" alignItems={"flex-start"}>
      <Icon as={RiMindMap} color="blue.500" boxSize="5" />
      <Flex direction="column" gap="5px">
        <Text fontWeight="bold">
          Lineage Diff{" "}
          <Text color="red" as="span">
            Live Reload
          </Text>
        </Text>

        <Text fontSize="sm">
          To view lineage diff in action, make a modeling change and rebuild your dbt project. Leave
          Recce running and{" "}
          <Text fontWeight="bold" as="span">
            model changes will be automatically detected
          </Text>{" "}
          and displayed.
        </Text>
        <Link
          color="blue.500"
          fontSize="sm"
          fontWeight="medium"
          isExternal
          href="https://datarecce.io/docs/get-started/#prepare-dbt-artifacts">
          Learn how
        </Link>
      </Flex>
    </Flex>
  );
}

function QueryViewTopBar({ current }: { current?: NodeData }) {
  return (
    <Flex
      justifyContent="right"
      alignItems="center"
      padding="4pt 8pt"
      gap="5px"
      height="54px"
      borderBottom="1px solid lightgray"
      flex="0 0 54px">
      <Box>
        <Heading as="h2" size="md" display="flex" alignItems="center" gap="5px">
          <Icon as={AiOutlineExperiment} boxSize="1.2em" />
          Query
        </Heading>
        <Text fontSize="xs" color="gray.500">
          Query model by SQL
        </Text>
      </Box>
      <Spacer />
      {/* Disable the Diff button to let user known they should configure the base environment */}
      <Tooltip label="Please configure the base environment before running the diff">
        <Button colorScheme="blue" isDisabled={true} size="xs" fontSize="14px" marginTop={"16px"}>
          Run Diff
        </Button>
      </Tooltip>
    </Flex>
  );
}

interface QueryViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
  height?: string;
}

export function SingleEnvironmentQueryView({ isOpen, onClose, current }: QueryViewProps) {
  const {
    isOpen: isRunResultOpen,
    onClose: onRunResultClose,
    onOpen: onRunResultOpen,
  } = useDisclosure();
  const [queryCode, setQueryCode] = useState<string>(`SELECT * FROM {{ ref("${current?.name}")}}`);
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { lineageGraph } = useLineageGraphContext();
  let currentSchema = "N/A";
  if (lineageGraph?.nodes[current?.id || ""]) {
    const value = lineageGraph.nodes[current?.id || ""];
    if (value.data.current?.schema) {
      currentSchema = value.data.current.schema;
    }
  }

  // Set the default query code when the current node changes
  useEffect(() => {
    setQueryCode(`SELECT * FROM {{ ref("${current?.name}")}}`);
  }, [current]);

  const queryFn = async () => {
    const sqlTemplate = queryCode;
    const runFn = submitQuery;
    const params: QueryParams = {
      sql_template: sqlTemplate,
    };
    const options: SubmitOptions = { nowait: true };
    const { run_id } = await runFn(params, options);

    showRunId(run_id);

    return await waitRun(run_id);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
  });

  return (
    <Modal
      isOpen={isOpen}
      size="full"
      onClose={() => {
        onClose();
        onRunResultClose();
        clearRunResult();
      }}>
      <ModalContent height={"100%"}>
        <ModalHeader height={"40px"} bg="rgb(77, 209, 176)" px={0} py={4}>
          <Flex alignItems="center" height={"100%"} gap={"10px"}>
            <Image
              boxSize="20px"
              ml="18px"
              src="/logo/recce-logo-white.png"
              alt="recce-logo-white"
            />
            <Heading as="h1" fontFamily={`"Montserrat", sans-serif`} fontSize="lg" color="white">
              RECCE
            </Heading>
            <Badge fontSize="sm" color="white" colorScheme="whiteAlpha" variant="outline">
              Experiment
            </Badge>
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
          <VSplit
            sizes={isRunResultOpen ? [50, 50] : [100, 0]}
            minSize={isRunResultOpen ? 100 : 0}
            gutterSize={isRunResultOpen ? 5 : 0}
            style={{
              flex: "1",
              contain: "size",
              height: "100%",
            }}>
            <Box p={0} style={{ contain: "content" }}>
              <Flex direction="column" height="100%" m={0} p={0}>
                <QueryViewTopBar current={current} />
                <DualSqlEditor
                  value={queryCode}
                  onChange={setQueryCode}
                  onRun={() => {
                    runQuery();
                    onRunResultOpen();
                  }}
                  labels={["base (production)", `current (${currentSchema})`]}
                  BaseEnvironmentSetupGuide={<BaseEnvironmentSetupGuide />}
                />
              </Flex>
            </Box>
            {isRunResultOpen ? (
              <RunResultPane onClose={onRunResultClose} disableAddToChecklist />
            ) : (
              <Box></Box>
            )}
          </VSplit>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
