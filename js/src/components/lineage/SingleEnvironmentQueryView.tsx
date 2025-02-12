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
  Stack,
  Link,
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

function BaseEnvironmentSetupGuide() {
  return (
    <Box height={"100%"}>
      <Stack spacing={4} p={4} m={"32px"} fontSize={"sm"}>
        <Heading as="h1" size="md">
          Config the Base Environment to run query diff
        </Heading>
        <Text>
          To diff the model by SQL, you need to setup two environments.
          Currently, only the target environment is setup.
        </Text>
        <Text>
          Please configure the base environment before running the query diff.
        </Text>
        <Link
          textDecor="underline"
          isExternal
          color={"blue.500"}
          href="https://datarecce.io/docs/get-started/#prepare-dbt-artifacts"
        >
          Learn how
        </Link>
      </Stack>
    </Box>
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
      flex="0 0 54px"
    >
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
        <Button
          colorScheme="blue"
          isDisabled={true}
          size="xs"
          fontSize="14px"
          marginTop={"16px"}
        >
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

export function SingleEnvironmentQueryView({
  isOpen,
  onClose,
  current,
}: QueryViewProps) {
  const {
    isOpen: isRunResultOpen,
    onClose: onRunResultClose,
    onOpen: onRunResultOpen,
  } = useDisclosure();
  const [queryCode, setQueryCode] = useState<string>(
    `SELECT * FROM {{ ref("${current?.name}")}}`
  );
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { lineageGraph } = useLineageGraphContext();
  let currentSchema = "N/A";
  if (lineageGraph?.nodes && lineageGraph?.nodes[current?.id || ""]) {
    const value = lineageGraph?.nodes[current?.id || ""];
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
      }}
    >
      <ModalContent height={"100%"}>
        <ModalHeader height={"40px"} bg="rgb(77, 209, 176)" px={0} py={4}>
          <Flex alignItems="center" height={"100%"} gap={"10px"}>
            <Image
              boxSize="20px"
              ml="18px"
              src="/logo/recce-logo-white.png"
              alt="recce-logo-white"
            />
            <Heading
              as="h1"
              fontFamily={`"Montserrat", sans-serif`}
              fontSize="lg"
              color="white"
            >
              RECCE
            </Heading>
            <Badge
              fontSize="sm"
              color="white"
              colorScheme="whiteAlpha"
              variant="outline"
            >
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
            }}
          >
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
