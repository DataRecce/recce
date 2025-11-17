import { Flex, HStack, IconButton, Image, Link } from "@chakra-ui/react";
import React, { useState } from "react";
import { LuExternalLink } from "react-icons/lu";
import { toaster } from "@/components/ui/toaster";

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
    <Flex
      gap={4}
      justifyContent="center"
      alignContent={"center"}
      alignItems={"center"}
    >
      {description}
      <IconButton
        aria-label="thumbs up"
        variant={"ghost"}
        width={"32px"}
        height={"32px"}
        onClick={onLike}
      >
        <Image src="/imgs/feedback/thumbs-up.png" alt="like" />
      </IconButton>
      <IconButton
        aria-label="thumbs down"
        variant={"ghost"}
        width={"32px"}
        height={"32px"}
        onClick={onDislike}
      >
        <Image src="/imgs/feedback/thumbs-down.png" alt="dislike" />
      </IconButton>
      {externalLink && externalLinkText && (
        <Link
          href={externalLink}
          target="_blank"
          textDecoration="underline"
          onClick={onClickLink}
        >
          {externalLinkText} <LuExternalLink />
        </Link>
      )}
    </Flex>
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
          <HStack>
            <ReactionFeedback
              description={description}
              onLike={() => {
                onFeedbackSubmit("like");
                toaster.dismiss(toastId);
                localStorage.setItem(feedbackId, "true");
              }}
              onDislike={() => {
                onFeedbackSubmit("dislike");
                toaster.dismiss(toastId);
                localStorage.setItem(feedbackId, "true");
              }}
              externalLink={externalLink}
              externalLinkText={externalLinkText}
              onClickLink={() => {
                onFeedbackSubmit("link");
              }}
            />
          </HStack>
        ),
      }),
    );
  }

  return {
    feedbackToast: feedBackCollectionToast,
    closeToast: () => {
      toaster.dismiss(toastId);
    },
  };
}
