/**
 * Next.js App Router Error Boundary
 *
 * This file handles runtime errors within route segments.
 * It automatically wraps the route segment in a React Error Boundary.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

"use client";

import { Box, Button, Center, Flex, Heading } from "@chakra-ui/react";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: https://nextjs.org/docs/app/api-reference/file-conventions/error
export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: "app",
        digest: error.digest,
      },
      extra: {
        componentStack: error.stack,
      },
    });

    // Also log to console for development
    console.error("App Error Boundary caught error:", error);
  }, [error]);

  return (
    <Center height="100%" backgroundColor="gray.50">
      <Flex
        p={4}
        direction="column"
        justifyContent="flex-start"
        backgroundColor="white"
        border="solid lightgray 1px"
        borderRadius="md"
        minHeight="200px"
        boxShadow="md"
      >
        <Heading width="800px" size="md" mb={4}>
          You have encountered an error
        </Heading>

        <Box flex="1" fontSize="10pt" color="gray.600" mb={4}>
          {error.message || String(error)}
        </Box>

        {error.digest && (
          <Box fontSize="9pt" color="gray.400" mb={4}>
            Error ID: {error.digest}
          </Box>
        )}

        <Button
          justifySelf="center"
          alignSelf="center"
          mt="20px"
          colorPalette="blue"
          size="sm"
          onClick={() => {
            // Attempt to recover by re-rendering the route segment
            reset();
          }}
        >
          Try again
        </Button>
      </Flex>
    </Center>
  );
}
