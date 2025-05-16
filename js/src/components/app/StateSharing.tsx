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
  PopoverFooter,
  ButtonGroup,
  PopoverHeader,
  PopoverCloseButton,
} from "@chakra-ui/react";
import { CheckCircleIcon, CopyIcon } from "@chakra-ui/icons";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";
import { PUBLIC_CLOUD_WEB_URL } from "@/lib/const";
import { TbCloudUpload, TbExternalLink } from "react-icons/tb";
import { trackShareState } from "@/lib/api/track";
import { ReactNode } from "react";

interface ShareModalProps {
  handleClose: () => void;
}

export function UnAuthShareModalContent({ handleClose }: ShareModalProps): ReactNode {
  return (
    <PopoverContent bg="gray.200" color="black" sx={{ width: "max-content" }}>
      <PopoverHeader fontWeight="semibold">Enable sharing</PopoverHeader>
      <PopoverCloseButton />
      <PopoverBody fontSize="sm">
        API token required.{" "}
        <Link
          href="https://docs.datarecce.io/recce-cloud/share-recce-session-securely"
          target="_blank"
          textDecoration="underline">
          Learn more
        </Link>
        .
      </PopoverBody>
      <PopoverFooter border="0" display="flex" alignItems="center" justifyContent="flex-end" pb={4}>
        <ButtonGroup size="sm">
          <Link
            onClick={() => {
              trackShareState({ name: "enable" });
              handleClose();
            }}
            href={`${PUBLIC_CLOUD_WEB_URL}/signin?callbackUrl=/relaunch&utm_source=recce_oss&utm_content=enable_sharing_button#tokens`}
            target="_blank">
            <Button colorScheme="blue" rightIcon={<TbExternalLink />}>
              Enable
            </Button>
          </Link>
          <Button
            colorScheme="gray"
            onClick={() => {
              handleClose();
            }}>
            Cancel
          </Button>
        </ButtonGroup>
      </PopoverFooter>
    </PopoverContent>
  );
}

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
        <Popover placement="bottom-start">
          {({ onClose }) => (
            <>
              <PopoverTrigger>
                <Button size="sm" variant="outline" leftIcon={<TbCloudUpload />}>
                  Share
                </Button>
              </PopoverTrigger>
              <UnAuthShareModalContent handleClose={onClose} />
            </>
          )}
        </Popover>
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
