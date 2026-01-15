import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { PiCheckCircle, PiCopy } from "react-icons/pi";
import { TbCloudUpload } from "react-icons/tb";
import { useCopyToClipboard, useInterval } from "usehooks-ts";
import { useRecceInstanceContext } from "../../contexts";
import { useClipBoardToast, useRecceShareStateContext } from "../../hooks";
import { trackShareState } from "../../lib/api/track";
import AuthModal from "./AuthModal";

const LOADING_MESSAGES = [
  "Processing...", // 0-30s
  "Still processing, please wait...", // 30-60s
  "Almost there, thanks for your patience...", // 60s+
];

export function TopLevelShare() {
  const { successToast, failToast } = useClipBoardToast();
  const [, copyToClipboard] = useCopyToClipboard();
  const { authed } = useRecceInstanceContext();
  const { shareUrl, isLoading, error, handleShareClick } =
    useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);

  // Reset message index when loading starts (during render)
  if (isLoading !== prevIsLoading) {
    setPrevIsLoading(isLoading);
    if (isLoading) {
      // Loading just started, reset to 0
      setMessageIndex(0);
    }
  }

  // Increment message index every 30 seconds while loading
  useInterval(
    () => {
      setMessageIndex((prev) =>
        Math.min(prev + 1, LOADING_MESSAGES.length - 1),
      );
    },
    isLoading ? 30000 : null,
  );

  // Show error toast when sharing fails
  useEffect(() => {
    if (error) {
      failToast("Failed to share state", error);
    }
  }, [error, failToast]);

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
      <Stack direction="row" sx={{ flex: 1, alignItems: "center" }}>
        <Button
          size="xsmall"
          color="neutral"
          variant="outlined"
          onClick={() => {
            setShowModal(true);
          }}
          startIcon={<TbCloudUpload />}
        >
          Share
        </Button>
        {showModal && (
          <AuthModal
            parentOpen={showModal}
            handleParentClose={setShowModal}
            ignoreCookie
            variant="enable-share"
          />
        )}
      </Stack>
    );
  }

  return (
    <Stack direction="row" sx={{ flex: 1, alignItems: "center", gap: "5px" }}>
      <Button
        size="xsmall"
        variant="outlined"
        color="neutral"
        startIcon={<TbCloudUpload />}
        endIcon={
          shareUrl ? (
            <Box component={PiCheckCircle} sx={{ color: "success.main" }} />
          ) : undefined
        }
        onClick={async () => {
          await handleShareClick();
          trackShareState({ name: "create" });
        }}
        disabled={isLoading}
      >
        {isLoading ? "Sharing..." : "Share"}
      </Button>
      {isLoading && (
        <Typography sx={{ fontSize: 14, color: "grey.500" }}>
          {LOADING_MESSAGES[messageIndex]}
        </Typography>
      )}
      <Stack direction="row" spacing={0.5} alignItems="center">
        {shareUrl && (
          <>
            <Box
              sx={{
                overflowX: "auto",
                whiteSpace: "nowrap",
                maxWidth: "350px",
              }}
            >
              <Typography sx={{ fontSize: 14 }}>{shareUrl}</Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Copy the share URL"
              onClick={async () => {
                await handleCopy();
                trackShareState({ name: "copy" });
              }}
            >
              <PiCopy />
            </IconButton>
          </>
        )}
      </Stack>
    </Stack>
  );
}
