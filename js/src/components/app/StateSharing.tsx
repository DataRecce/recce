import { Flex, Text, Spinner, IconButton, Button, Tooltip, useClipboard } from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";

export function TopLevelShare() {
  const { successToast, failToast } = useClipBoardToast();
  const { onCopy } = useClipboard("");
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } = useRecceShareStateContext();

  const handleCopy = () => {
    try {
      onCopy(shareUrl);
      successToast("Copied the link to clipboard");
    } catch (error) {
      failToast("Failed to copy the link", error);
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
              onClick={handleCopy}
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
