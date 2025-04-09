import React, { useState } from "react";
import { Flex, Text, Spinner, IconButton, Button, Tooltip } from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { shareState } from "@/lib/api/state";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

export function ShareSwitch() {
  const { authed } = useRecceInstanceContext();
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>();
  const [error, setError] = useState<string>();

  const handleShareClick = async () => {
    setIsLoading(true);
    setError(undefined);
    setShareUrl(undefined);
    try {
      const response = await shareState();
      if (response.status !== "success") {
        setError(response.message);
        return;
      }
      setShareUrl(response.share_url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

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
        variant="outline"
        onClick={handleShareClick}
        rightIcon={shareUrl ? <CheckCircleIcon color="green" /> : undefined}>
        Share
      </Button>
      <Flex gap="5px" alignItems="center">
        {isLoading && <Spinner size="sm" />}
        {shareUrl && (
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
        {error && (
          <Text fontSize="14" color="red.500">
            {error}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
