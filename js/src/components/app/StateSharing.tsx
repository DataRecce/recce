import {
  Flex,
  Text,
  IconButton,
  Button,
  useClipboard,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  Link,
} from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { PUBLIC_CLOUD_WEB_URL } from "@/lib/const";
import { TbCloudUpload } from "react-icons/tb";

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
        <Popover trigger="hover" placement="bottom-start">
          <PopoverTrigger>
            <Button
              rightIcon={<ExternalLinkIcon />}
              size="sm"
              onClick={() => {
                window.open(`${PUBLIC_CLOUD_WEB_URL}/settings#tokens`, "_blank");
              }}>
              Enable sharing
            </Button>
          </PopoverTrigger>
          <PopoverContent bg="black" color="white" sx={{ width: "max-content" }}>
            <PopoverBody fontSize="sm">
              API token required.{" "}
              <Link
                href="https://datarecce.io/docs/recce-cloud/share-recce-session-securely"
                target="_blank"
                textDecoration="underline">
                Learn more
              </Link>
              .
            </PopoverBody>
          </PopoverContent>
        </Popover>
      </Flex>
    );
  }

  return (
    <Flex flex="1" alignItems="center" gap="5px">
      <Button
        size="sm"
        variant="outline"
        onClick={handleShareClick}
        leftIcon={<TbCloudUpload />}
        rightIcon={shareUrl ? <CheckCircleIcon color="green" /> : undefined}
        isLoading={isLoading}>
        Share
      </Button>
      <Flex gap="5px" alignItems="center">
        {shareUrl && (
          <>
            <Flex overflowX="auto" whiteSpace="nowrap" maxWidth="350px">
              <Text fontSize="14">{shareUrl}</Text>
            </Flex>
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
