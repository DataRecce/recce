import { Box, Button, Center, Flex, Heading } from "@chakra-ui/react";
import {
  FallbackRender,
  ErrorBoundary as SentryErrorBoundary,
} from "@sentry/react";
import * as React from "react";
import { ReactNode, useState } from "react";

const Fallback: FallbackRender = (errorData) => {
  return (
    <Center height="100%" backgroundColor="gray.50">
      <Flex
        p={4}
        direction="column"
        justifyContent="flex-start"
        backgroundColor="white"
        border="solid lightgray 1px"
        minHeight="200px"
      >
        <Heading width="800px" size="md">
          You have encountered an error
        </Heading>

        <Box flex="1" fontSize="10pt">
          {String(errorData.error)}
        </Box>

        <Button
          justifySelf="center"
          alignSelf={"center"}
          mt="20px"
          colorPalette="blue"
          size="sm"
          onClick={() => {
            errorData.resetError();
          }}
        >
          Reset
        </Button>
      </Flex>
    </Center>
  );
};

/* For testing purposes only */
// noinspection JSUnusedGlobalSymbols
export const ErrorButton = () => {
  const [a, setA] = useState<{ foo: string } | undefined>({ foo: "bar" });

  return (
    <Button
      pos="absolute"
      onClick={() => {
        setA(undefined);
      }}
      zIndex={1}
    >
      {a?.foo}
    </Button>
  );
};

export const ErrorBoundary = ({
  children,
  fallback = Fallback,
}: {
  children: ReactNode;
  fallback?: React.ReactElement | FallbackRender | undefined;
}) => {
  return (
    <SentryErrorBoundary fallback={fallback}>{children}</SentryErrorBoundary>
  );
};
