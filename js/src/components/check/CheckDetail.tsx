import {
  Box,
  Center,
  Checkbox,
  Flex,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Spacer,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { CheckBreadcrumb } from "./CheckBreadcrumb";
import { VscKebabVertical } from "react-icons/vsc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, deleteCheck, getCheck, updateCheck } from "@/lib/api/checks";
import { QueryDiffView } from "@/components/check/QueryDiffView";
import { ValueDiffView } from "@/components/check/ValueDiffView";
import { SchemaDiffView } from "./SchemaDiffView";
import { useLocation } from "wouter";
import { CheckDescription } from "./CheckDescription";

interface CheckDetailProps {
  checkId: string;
}

export const CheckDetail = ({ checkId }: CheckDetailProps) => {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const {
    isLoading,
    error,
    data: check,
  } = useQuery({
    queryKey: cacheKeys.check(checkId),
    queryFn: () => getCheck(checkId),
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000,
  });

  const { mutate } = useMutation({
    mutationFn: (check: Partial<Check>) => updateCheck(checkId, check),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.check(checkId) });
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    },
  });

  const { mutate: handleDelete } = useMutation({
    mutationFn: () => deleteCheck(checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation("/checks");
    },
  });

  if (isLoading) {
    return <Center h="100%">Loading</Center>;
  }

  if (error) {
    return <Center h="100%">Error: {error.message}</Center>;
  }

  const handleCheck: React.ChangeEventHandler = (event) => {
    const isChecked: boolean = (event.target as any).checked;
    mutate({ is_checked: isChecked });
  };

  const handleUpdateDescription = (description?: string) => {
    mutate({ description });
  };

  return (
    <Flex height="100%" width="100%" maxHeight="100%" direction="column">
      <Flex p="0px 16px" alignItems="center">
        <CheckBreadcrumb
          name={check?.name || ""}
          setName={(name) => {
            mutate({ name });
          }}
        />
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<Icon as={VscKebabVertical} />}
            variant="ghost"
          />
          <MenuList>
            <MenuItem icon={<DeleteIcon />} onClick={() => handleDelete()}>
              Delete
            </MenuItem>
          </MenuList>
        </Menu>
        <Spacer />
        <Checkbox isChecked={check?.is_checked} onChange={handleCheck}>
          Check
        </Checkbox>
      </Flex>

      {/* <Divider /> */}

      <Box p="8px 16px" minHeight="100px">
        <CheckDescription
          key={check?.check_id}
          value={check?.description}
          onChange={handleUpdateDescription}
        />
      </Box>

      {check && check.type == "query_diff" && <QueryDiffView check={check} />}
      {check && check.type == "value_diff" && <ValueDiffView check={check} />}
      {check && check.type == "schema_diff" && <SchemaDiffView check={check} />}

    </Flex>
  );
};
