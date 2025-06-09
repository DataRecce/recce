import {
  Flex,
  Heading,
  Button,
  Icon,
  Text,
  Link,
  ListItem,
  UnorderedList,
} from "@chakra-ui/react";
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
      justifyContent={"center"}
    >
      <Flex w="80%" direction="column" overflowY="auto" gap={6} px={8} pb={8}>
        <Flex direction="column" alignItems={"center"} gap={4}>
          <Flex
            p={2}
            bg="white"
            borderRadius="full"
            alignItems="center"
            justifyContent="center"
            boxShadow="md"
          >
            <Icon as={RiTerminalBoxLine} boxSize={7} color="blue.500" />
          </Flex>
          <Heading mt="4" size="lg">
            Wait, there's more!
          </Heading>
          <Text fontSize="md" textAlign="center">
            Recce is currently running in{" "}
            <Text fontWeight="bold" as="span">
              limited functionality mode
            </Text>{" "}
            so you can run queries but{" "}
            <Text fontWeight="bold" as="span">
              can't diff the results yet!
            </Text>
          </Text>
        </Flex>
        <Flex direction="column" gap={2}>
          <Text fontSize="md">
            To unlock the full power of Recce, set up a base environment of dbt
            artifacts for comparison.
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
          <Text fontSize="md">
            Take the next step toward better data impact assessment.
          </Text>
        </Flex>
        <Flex w="100%" direction="column" mt={6}>
          <Button
            colorScheme="blue"
            size="lg"
            onClick={() => {
              window.open(
                "https://docs.datarecce.io/get-started/#prepare-dbt-artifacts",
                "_blank",
              );
            }}
          >
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
          Single Environment Mode{" "}
          <Text color="red" as="span">
            Limited Functionality
          </Text>
        </Text>

        <Text fontSize="sm">
          Single Environment Mode allows you to explore your dbt project but
          won't show data comparisons between environments.
        </Text>
        <Text fontSize="sm">To set up full environment comparison:</Text>
        <UnorderedList>
          <ListItem>
            <Text fontSize="sm">Run `recce debug` for setup assistance</Text>
          </ListItem>
          <ListItem>
            <Text fontSize="sm">
              Visit{" "}
              <Link
                color="blue.500"
                fontSize="sm"
                fontWeight="medium"
                isExternal
                href="https://docs.datarecce.io/configure-diff/"
              >
                docs{" "}
              </Link>
              for configuration details
            </Text>
          </ListItem>
        </UnorderedList>
      </Flex>
    </Flex>
  );
}
