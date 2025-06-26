import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { InfoOutlineIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Icon,
  Link,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Text,
} from "@chakra-ui/react";
import { useLineageViewContextSafe } from "./LineageViewContext";

interface BreakingChangeSwitchProps {
  enabled: boolean;
  onChanged: (enabled: boolean) => void;
}

export const BreakingChangeSwitch = ({ enabled, onChanged }: BreakingChangeSwitchProps) => {
  const recceServerFlag = useRecceServerFlag();
  const { showColumnLevelLineage } = useLineageViewContextSafe();
  if (!recceServerFlag.data || recceServerFlag.data.single_env_onboarding) {
    return <></>;
  }

  return (
    <Flex
      direction="row"
      alignItems="center"
      gap="5px"
      p="5px 10px"
      borderRadius="md"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
      bg="white"
      alignSelf="flex-start">
      <Button
        size="xs"
        onClick={() => {
          void showColumnLevelLineage({ no_upstream: true, change_analysis: true, no_cll: true });
        }}>
        Analyze change
      </Button>
      <Button
        size="xs"
        onClick={() => {
          void showColumnLevelLineage({ no_upstream: true, change_analysis: true });
        }}>
        Impact Raidus++
      </Button>
      <Switch
        isChecked={enabled}
        onChange={(e) => {
          const enabled = e.target.checked;

          onChanged(enabled);
        }}
        alignItems={"center"}></Switch>
      <Flex alignItems={"center"}>
        <Text fontSize="10pt" lineHeight="1">
          Breaking Change Analysis
        </Text>
      </Flex>
      <Popover trigger="hover" placement="top-start">
        <PopoverTrigger>
          <Icon boxSize="10px" as={InfoOutlineIcon} color="gray.500" cursor="pointer" />
        </PopoverTrigger>
        <PopoverContent bg="black" color="white">
          <PopoverBody fontSize="sm">
            Breaking changes are determined by analyzing SQL for changes that may impact downstream
            models.{" "}
            <Link
              href="https://docs.datarecce.io/features/breaking-change-analysis/"
              target="_blank"
              textDecoration="underline">
              Learn more
            </Link>
            .
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Flex>
  );
};
