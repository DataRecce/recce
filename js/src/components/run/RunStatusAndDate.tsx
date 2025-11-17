import { Flex, Spinner, Text } from "@chakra-ui/react";
import { format } from "date-fns";
import { Run } from "@/lib/api/types";

export function formatRunDate(date: Date | null) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date == null) {
    return null;
  }

  if (today.toDateString() === date.toDateString()) {
    return "Today";
  } else if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday";
  } else {
    return format(date, "MMM d");
  }
}

export function formatRunDateTime(date: Date | null) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date == null) {
    return null;
  }

  if (today.toDateString() === date.toDateString()) {
    return "Today, " + format(date, "HH:mm");
  } else if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday, " + format(date, "HH:mm");
  } else {
    return format(date, "MMM d, HH:mm");
  }
}

export const RunStatusAndDate = ({ run }: { run: Run }) => {
  const isRunning = run.status === "running";

  let status = run.status;
  if (!status) {
    if (run.result) {
      status = "finished";
    } else if (run.error) {
      status = "failed";
    }
  }

  let color: string;
  let message: string;
  if (status === "finished") {
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
  const dateTime = run.run_at ? formatRunDateTime(new Date(run.run_at)) : null;

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
