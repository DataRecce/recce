import {
  useToast,
  Alert,
  AlertDescription,
  Link,
  HStack,
  CloseButton,
  Text,
} from "@chakra-ui/react";

export function useGuideToast(options: {
  guideId: string;
  description: string;
  externalLink?: string;
  externalLinkText?: string;
}) {
  const toast = useToast();
  const { guideId, description, externalLink, externalLinkText } = options;

  function guideToast() {
    if (toast.isActive(guideId)) {
      // Don't show the toast again if it's already active
      return;
    }

    toast({
      id: guideId,
      position: "bottom-right",
      duration: 3000,
      description: "some text",
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
              <Text>
                {description}{" "}
                <Link
                  textDecor="underline"
                  isExternal
                  href={externalLink}
                  onClick={() => {
                    onClose();
                  }}
                >
                  {externalLinkText}
                </Link>
              </Text>
              <CloseButton
                onClick={() => {
                  onClose();
                }}
              />
            </HStack>
          </AlertDescription>
        </Alert>
      ),
    });
  }

  return {
    guideToast: guideToast,
    closeGuideToast: () => toast.closeAll(),
  };
}
