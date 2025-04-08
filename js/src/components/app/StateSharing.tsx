import React, { useState, useEffect } from "react";
import { Switch, FormControl, FormLabel, Flex, Text, Spinner, IconButton } from "@chakra-ui/react";
import { CopyIcon } from "@chakra-ui/icons";
import { shareState } from "@/lib/api/state";

export function ShareSwitch() {
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [isSharingEnabled, setIsSharingEnabled] = useState(false);

  useEffect(() => {
    const fetchShareUrl = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const response = await shareState();
        if (response.error) {
          setError(response.error);
          return;
        }
        setShareUrl(response.share_url);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    if (isSharingEnabled) {
      void fetchShareUrl();
    } else {
      setShareUrl(undefined);
    }
  }, [isSharingEnabled]);

  return (
    <Flex flex="1" alignItems="center" mt="5px" gap="5px">
      <FormControl display="flex" flex="0" alignItems="center">
        <FormLabel htmlFor="share-toggle" mb="0">
          Share
        </FormLabel>
        <Switch
          id="share-toggle"
          size={"sm"}
          isChecked={isSharingEnabled}
          onChange={() => {
            setIsSharingEnabled(!isSharingEnabled);
          }}
          isDisabled={isLoading}
        />
      </FormControl>
      <Flex gap="5px" alignItems="center">
        {isLoading && <Spinner size="sm" />}
        {isSharingEnabled && shareUrl && (
          <>
            <Text fontSize="14">{shareUrl}</Text>
            <IconButton
              size="xs"
              aria-label="Search database"
              icon={<CopyIcon />}
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            />
          </>
        )}
        {isSharingEnabled && error && (
          <Text fontSize="14" color="red.500">
            {error}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
