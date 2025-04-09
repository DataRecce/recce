import { Flex, Text, Spinner, IconButton, Button, Tooltip } from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";

export function TopLevelShare() {
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } = useRecceShareStateContext();

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
