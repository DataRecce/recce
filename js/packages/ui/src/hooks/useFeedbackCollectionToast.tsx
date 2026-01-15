import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import { LuExternalLink } from "react-icons/lu";
import { toaster } from "../components/ui/Toaster";

function ReactionFeedback({
  description,
  onLike,
  onDislike,
  onClickLink,
  externalLink,
  externalLinkText,
}: {
  description: string;
  onLike: () => void;
  onDislike: () => void;
  onClickLink: () => void;
  externalLink?: string;
  externalLinkText?: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 4,
        justifyContent: "center",
        alignContent: "center",
        alignItems: "center",
      }}
    >
      {description}
      <IconButton
        aria-label="thumbs up"
        onClick={onLike}
        sx={{ width: "32px", height: "32px" }}
      >
        <Box component="img" src="/imgs/feedback/thumbs-up.png" alt="like" />
      </IconButton>
      <IconButton
        aria-label="thumbs down"
        onClick={onDislike}
        sx={{ width: "32px", height: "32px" }}
      >
        <Box
          component="img"
          src="/imgs/feedback/thumbs-down.png"
          alt="dislike"
        />
      </IconButton>
      {externalLink && externalLinkText && (
        <Link
          href={externalLink}
          target="_blank"
          onClick={onClickLink}
          sx={{ textDecoration: "underline" }}
        >
          {externalLinkText} <LuExternalLink />
        </Link>
      )}
    </Box>
  );
}

export function useFeedbackCollectionToast(options: {
  feedbackId: string;
  description: string;
  onFeedbackSubmit: (feedback: string) => void;
  externalLink?: string;
  externalLinkText?: string;
}) {
  const {
    feedbackId,
    description,
    onFeedbackSubmit,
    externalLink,
    externalLinkText,
  } = options;
  const [toastId, setToastId] = useState<string | undefined>(undefined);

  function feedBackCollectionToast(skipBypassFeedback = false) {
    const isSkipFeedback = localStorage.getItem(feedbackId);
    if (toastId != null) {
      // Don't show the toast again if it's already active
      return;
    }
    if (isSkipFeedback === "true" && !skipBypassFeedback) {
      return;
    }

    setToastId(
      toaster.create({
        id: feedbackId,
        duration: undefined,
        type: "success",
        description: (
          <Stack direction="row">
            <ReactionFeedback
              description={description}
              onLike={() => {
                onFeedbackSubmit("like");
                toaster.dismiss(feedbackId);
                localStorage.setItem(feedbackId, "true");
              }}
              onDislike={() => {
                onFeedbackSubmit("dislike");
                toaster.dismiss(feedbackId);
                localStorage.setItem(feedbackId, "true");
              }}
              externalLink={externalLink}
              externalLinkText={externalLinkText}
              onClickLink={() => {
                onFeedbackSubmit("link");
              }}
            />
          </Stack>
        ),
      }),
    );
  }

  return {
    feedbackToast: feedBackCollectionToast,
    closeToast: () => {
      if (toastId) toaster.dismiss(toastId);
    },
  };
}
