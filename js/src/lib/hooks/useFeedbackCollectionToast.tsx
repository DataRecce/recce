import {
  useToast,
  Alert,
  AlertTitle,
  AlertDescription,
  Flex,
  IconButton,
} from "@chakra-ui/react";
import { AiFillDislike, AiFillLike } from "react-icons/ai";
import { localStorageKeys } from "../api/localStorageKeys";

enum FeedbackType {
  reaction = "reaction",
  score = "score",
}

export function useFeedbackCollectionToast(
  feedbackId: string,
  feedbackName: string,
  description: string,
  type: FeedbackType = FeedbackType.reaction
) {
  const toast = useToast();

  function feedBackCollectionToast() {
    if (toast.isActive(feedbackId)) {
      // Don't show the toast again if it's already active
      return;
    }

    const isSkipFeedback = localStorage.getItem(
      localStorageKeys.bypassPreviewChangeFeedback
    );

    if (isSkipFeedback !== "true") {
      toast({
        id: feedbackId,
        position: "bottom-right",
        duration: null,
        isClosable: true,
        render: () => (
          <Alert
            status="success"
            variant="subtle"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            textAlign="center"
            height="200px"
            zIndex={"toast"}
            borderRadius={4}
            opacity={1}
          >
            <AlertTitle mt={4} mb={1} fontSize="lg">
              How was your experience?
            </AlertTitle>
            <AlertDescription maxWidth="sm">{description}</AlertDescription>
            <Flex gap={16} mt={4}>
              <IconButton
                aria-label="thumbs up"
                icon={<AiFillLike />}
                onClick={() => {
                  // sendFeedback("like");
                  toast.closeAll();
                  localStorage.setItem(
                    localStorageKeys.bypassPreviewChangeFeedback,
                    "true"
                  );
                }}
              />
              <IconButton
                aria-label="thumbs down"
                icon={<AiFillDislike />}
                onClick={() => {
                  // sendFeedback("dislike");
                  toast.closeAll();
                  localStorage.setItem(
                    localStorageKeys.bypassPreviewChangeFeedback,
                    "true"
                  );
                }}
              />
            </Flex>
          </Alert>
        ),
      });
    }
  }

  return {
    feedbackToast: feedBackCollectionToast,
  };
}
