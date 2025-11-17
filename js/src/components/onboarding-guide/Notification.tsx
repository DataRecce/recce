import { CloseButton, Flex, Icon, Link, Spacer } from "@chakra-ui/react";
import { SystemProps } from "@chakra-ui/styled-system";
import { PropsWithChildren } from "react";
import { FiInfo } from "react-icons/fi";
import { LuExternalLink } from "react-icons/lu";

export const RecceNotification = (
  props: PropsWithChildren<{
    onClose: () => void;
    align?: SystemProps["alignItems"];
  }>,
) => {
  return (
    <Flex
      flex="1"
      minH={"48px"}
      m="4px"
      px="16px"
      py="12px"
      bg="blue.50"
      border="1px"
      borderRadius="4px"
      borderColor="blue.400"
      align={props.align ?? "center"}
      gap="12px"
    >
      <Icon as={FiInfo} width={"20px"} height={"20px"} color={"blue.900"} />
      {props.children}
      <Spacer />
      <CloseButton onClick={props.onClose} />
    </Flex>
  );
};

export const LearnHowLink = () => {
  return (
    <Link
      href="https://docs.datarecce.io/get-started/#prepare-dbt-artifacts"
      target="_blank"
      color="rgba(49, 130, 206, 1)"
      fontWeight={"bold"}
      textDecoration={"underline"}
    >
      Learn how <LuExternalLink />
    </Link>
  );
};
