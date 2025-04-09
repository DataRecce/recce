import React, { useState, useEffect } from "react";
import { Switch, Flex, Text, Spinner, IconButton, Button, Tooltip } from "@chakra-ui/react";
import { CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { shareState } from "@/lib/api/state";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

export function ShareSwitch() {
  const { authed } = useRecceInstanceContext();
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

  if (!authed) {
    return (
      <Flex flex="1" alignItems="center">
        <Tooltip label="Please copy api token and relaunch recce with token">
          <Button
            rightIcon={<ExternalLinkIcon />}
            size="sm"
            onClick={() => {
              window.open("https://cloud.datarecce.io/settings#tokens", "_blank");
            }}>
            Enable sharing
          </Button>
        </Tooltip>
      </Flex>
    );
  }

  return (
    <Flex flex="1" alignItems="center" gap="5px">
      <Button
        size="sm"
        onClick={() => {
          setIsSharingEnabled(!isSharingEnabled);
        }}
        rightIcon={
          <Switch
            id="share-toggle"
            size={"sm"}
            isChecked={isSharingEnabled}
            isReadOnly
            pointerEvents="none"
          />
        }>
        Share
      </Button>
      <Flex gap="5px" alignItems="center">
        {isLoading && <Spinner size="sm" />}
        {isSharingEnabled && shareUrl && (
          <>
            <Text fontSize="14">{shareUrl}</Text>
            <IconButton
              size="xs"
              aria-label="Copy the share URL"
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
