import { Flex, Text, IconButton, Button, useClipboard } from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon } from "@chakra-ui/icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { TbCloudUpload } from "react-icons/tb";
import { trackShareState } from "@/lib/api/track";
import { useState } from "react";
import AuthModal from "@/components/AuthModal/AuthModal";

export function TopLevelShare() {
  const { successToast, failToast } = useClipBoardToast();
  const { onCopy } = useClipboard("");
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } = useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);

  const handleCopy = () => {
    try {
      onCopy(shareUrl);
      successToast("Copied the link to clipboard");
    } catch (error) {
      failToast("Failed to copy the link", error);
    }
  };

  const onClose = () => {
    setShowModal(false);
  };

  if (!authed) {
    return (
      <Flex flex="1" alignItems="center">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<TbCloudUpload />}
          onClick={() => {
            setShowModal(true);
          }}>
          Share
        </Button>
        {showModal && <AuthModal handleParentClose={onClose} />}
      </Flex>
    );
  }

  return (
    <Flex flex="1" alignItems="center" gap="5px">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await handleShareClick();
          trackShareState({ name: "create" });
        }}
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
              onClick={() => {
                handleCopy();
                trackShareState({ name: "copy" });
              }}
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
