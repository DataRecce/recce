import {
  useToast,
  Alert,
  AlertDescription,
  Link,
  Image,
  Flex,
  IconButton,
  HStack,
  CloseButton,
} from "@chakra-ui/react";

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
        icon={<Image src="/imgs/feedback/thumbs-up.png" alt="like" />}
        width={"32px"}
        height={"32px"}
        onClick={onLike}
      />
      <IconButton
        aria-label="thumbs down"
        variant={"ghost"}
        icon={<Image src="/imgs/feedback/thumbs-down.png" alt="dislike" />}
        width={"32px"}
        height={"32px"}
        onClick={onDislike}
      />
      {externalLink && externalLinkText && (
        <Link
          href={externalLink}
          isExternal
          textDecoration="underline"
          onClick={onClickLink}
        >
          {externalLinkText}
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
  const toast = useToast();
  const {
    feedbackId,
    description,
    onFeedbackSubmit,
    externalLink,
    externalLinkText,
  } = options;

  function feedBackCollectionToast(skipBypassFeedback: boolean = false) {
    const isSkipFeedback = localStorage.getItem(feedbackId);
    if (toast.isActive(feedbackId)) {
      // Don't show the toast again if it's already active
      return;
    }
    if (isSkipFeedback === "true" && skipBypassFeedback === false) {
      return;
    }

    toast({
      id: feedbackId,
      position: "bottom-right",
      duration: null,
      render: ({ id, onClose }) => (
        <Alert
          status="success"
          variant="subtle"
          zIndex={"toast"}
          borderColor={"gray.200"}
          borderWidth={3}
          borderRadius={"md"}
          backgroundColor={"white"}
          opacity={1}
        >
          <AlertDescription fontSize="md">
            <HStack>
              <ReactionFeedback
                description={description}
                onLike={() => {
                  onFeedbackSubmit("like");
                  toast.closeAll();
                  localStorage.setItem(feedbackId, "true");
                }}
                onDislike={() => {
                  onFeedbackSubmit("dislike");
                  toast.closeAll();
                  localStorage.setItem(feedbackId, "true");
                }}
                externalLink={externalLink}
                externalLinkText={externalLinkText}
                onClickLink={() => {
                  onFeedbackSubmit("link");
                }}
              />
              <CloseButton onClick={onClose} />
            </HStack>
          </AlertDescription>
        </Alert>
      ),
    });
  }

  return {
    feedbackToast: feedBackCollectionToast,
    closeToast: () => toast.closeAll(),
  };
}
