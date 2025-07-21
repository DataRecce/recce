import { Flex, Text, IconButton, Button } from "@chakra-ui/react";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { TbCloudUpload } from "react-icons/tb";
import { trackShareState } from "@/lib/api/track";
import { useState } from "react";
import { EnableShareModal } from "@/components/AuthModal/AuthModal";
import { useCopyToClipboard } from "usehooks-ts";
import { PiCheckCircle, PiCopy } from "react-icons/pi";

export function TopLevelShare() {
  const { successToast, failToast } = useClipBoardToast();
  const [, copyToClipboard] = useCopyToClipboard();
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } = useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);

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
        {showModal && <EnableShareModal parentOpen={showModal} handleParentClose={setShowModal} />}
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
