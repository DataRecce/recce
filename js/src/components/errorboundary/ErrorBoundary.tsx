import { Box, Button, Center, Flex, Heading } from "@chakra-ui/react";
import { FallbackRender, ErrorBoundary as SentryErrorBoundary } from "@sentry/react";
import { useState } from "react";

/* For testing purposes only */
export const ErrorButton = () => {
  const [a, setA] = useState<{ foo: string } | undefined>({ foo: "bar" });

  return (
    <Button
      pos="absolute"
      onClick={() => {
        setA(undefined);
      }}
      zIndex={1}>
      {a?.foo}
    </Button>
  );
};

// eslint-disable-next-line @typescript-eslint/unbound-method
const Fallback: FallbackRender = ({ error, resetError }) => {
  return (
    <Center height="100%" backgroundColor="gray.50">
      <Flex
        p={4}
        direction="column"
        justifyContent="flex-start"
        backgroundColor="white"
        border="solid lightgray 1px"
        minHeight="200px">
        <Heading width="800px" size="md">
          You have encountered an error
        </Heading>

        <Box flex="1" fontSize="10pt">
          {String(error)}
        </Box>

        <Button
          justifySelf="center"
          alignSelf={"center"}
          mt="20px"
          colorPalette="blue"
          size="sm"
          onClick={() => {
            resetError();
          }}>
          Reset
        </Button>
      </Flex>
    </Center>
  );
};

export const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  return <SentryErrorBoundary fallback={Fallback}>{children}</SentryErrorBoundary>;
};
