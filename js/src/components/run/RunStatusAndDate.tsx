import { Run } from "@/lib/api/types";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { format } from "date-fns";

export const RunStatusAndDate = ({ run }: { run: Run }) => {
  const isRunning = run?.status === "running";

  let status: string | undefined = run?.status;
  if (!status) {
    if (run.result) {
      status = "finished";
    } else if (run.error) {
      status = "failed";
    }
  }

  let color = "";
  let message = "";
  if (status === "successful" || status === "finished") {
    color = "green";
    message = "Finished";
  } else if (status === "failed") {
    color = "red";
    message = "Failed";
  } else if (status === "cancelled") {
    color = "gray";
    message = "Cancelled";
  } else if (status === "running") {
    color = "blue";
    message = "Running";
  } else {
    color = "green";
    message = "Finished";
  }
  const dateTime = run?.run_at
    ? format(new Date(run.run_at), "MMM d, HH:mm")
    : null;

  return (
    <Flex
      justifyContent="start"
      fontSize="11pt"
      color="gray.500"
      gap="3px"
      alignItems={"center"}
      overflow={"hidden"}
    >
      {isRunning && <Spinner size="xs" color={`${color}.400`} />}
      <Text fontWeight={500} color={`${color}.400`}>
        {message}
      </Text>
      <Text>•</Text>
      <Text textOverflow={"ellipsis"} overflow={"hidden"} whiteSpace="nowrap">
        {dateTime}
      </Text>
    </Flex>
  );
};
