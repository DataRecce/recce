import "react-data-grid/lib/styles.css";
import React, { useState, useCallback, useMemo } from "react";
import DataGrid from "react-data-grid";
import { AxiosError } from "axios";
import { toDataGrid } from "@/components/query/query";
import { Box, Button, Center, Flex, List, ListItem } from "@chakra-ui/react";
import { useListChecks } from "@/lib/api/checks";

export const CheckView = () => {
  const checks = useListChecks();

  if (checks.isFetching) {
    return <>Loading</>;
  }

  if (checks.isError) {
    return <>Error: {checks.error.message}</>;
  }

  if (checks.data?.length == 0) {
    return <Center h="100%">No checks</Center>;
  }

  return (
    <List>
      {checks.data?.map((check) => {
        return <ListItem key={check.check_id}>{check.name}</ListItem>;
      })}
    </List>
  );
};
