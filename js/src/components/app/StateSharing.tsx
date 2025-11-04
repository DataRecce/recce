import { Flex, Text, IconButton, Button } from "@chakra-ui/react";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { TbCloudUpload } from "react-icons/tb";
import { trackShareState } from "@/lib/api/track";
import { useState, useEffect } from "react";
import AuthModal from "@/components/AuthModal/AuthModal";
import { useCopyToClipboard, useInterval } from "usehooks-ts";
import { PiCheckCircle, PiCopy } from "react-icons/pi";

const LOADING_MESSAGES = [
  "Processing...", // 0-30s
  "Still processing, please wait...", // 30-60s
  "Almost there, thanks for your patience...", // 60s+
];

export function TopLevelShare() {
  const { successToast, failToast } = useClipBoardToast();
  const [, copyToClipboard] = useCopyToClipboard();
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } = useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  // Increment message index every 30 seconds while loading
  useInterval(
    () => {
      setMessageIndex((prev) => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
    },
    isLoading ? 30000 : null,
  );

  // Reset message index when loading state changes
  useEffect(() => {
    if (!isLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessageIndex(0);
    }
  }, [isLoading]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(String(shareUrl));
      successToast("Copied the link to clipboard");
    } catch (error) {
      failToast("Failed to copy the link", error);
    }
  };

  if (!authed) {
    return (
      <Flex flex="1" alignItems="center">
        <Button
          size="xs"
          colorPalette="gray"
          variant="outline"
          onClick={() => {
            setShowModal(true);
          }}>
          <TbCloudUpload /> Share
        </Button>
        {showModal && (
          <AuthModal
            parentOpen={showModal}
            handleParentClose={setShowModal}
            ignoreCookie
            variant="enable-share"
          />
        )}
      </Flex>
    );
  }

  return (
    <Flex flex="1" alignItems="center" gap="5px">
      <Button
        size="xs"
        variant="outline"
        colorPalette="gray"
        onClick={async () => {
          await handleShareClick();
          trackShareState({ name: "create" });
        }}
        loading={isLoading}>
        <TbCloudUpload /> Share {shareUrl ? <PiCheckCircle color="green" /> : undefined}
      </Button>
      {isLoading && (
        <Text fontSize="14" color="gray.500">
          {LOADING_MESSAGES[messageIndex]}
        </Text>
      )}
      <Flex gap="5px" alignItems="center">
        {shareUrl && (
          <>
            <Flex overflowX="auto" whiteSpace="nowrap" maxWidth="350px">
              <Text fontSize="14">{shareUrl}</Text>
            </Flex>
            <IconButton
              size="2xs"
              aria-label="Copy the share URL"
              onClick={async () => {
                await handleCopy();
                trackShareState({ name: "copy" });
              }}>
              <PiCopy />
            </IconButton>
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
