import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Image,
  List,
  ListItem,
  Stack,
  Divider,
} from "@chakra-ui/react";
import React from "react";
import { useEffect, useState } from "react";
import { markOnboardingCompleted } from "@/lib/api/flag";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";

interface GuideProps {
  isGuideOpen: boolean;
  closeGuide: () => void;
}

const FirstTimeVisitGuide = ({ isGuideOpen, closeGuide }: GuideProps) => {
  return (
    <Modal isOpen={isGuideOpen} onClose={closeGuide} scrollBehavior={"inside"}>
      <ModalOverlay />
      <ModalContent maxW="80vw" h="80vh">
        <ModalHeader>Welcome to Recce: 3 Steps to Begin</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            <List spacing={2}>
              <ListItem>Step 1: Click the model you want to check</ListItem>
              <ListItem>Step 2: Click &quot;Explore Change&quot;</ListItem>
              <ListItem>Step 3: Click &quot;Add to Checklist&quot;</ListItem>
            </List>
            <Divider />
            <Image
              src="https://datarecce.io/assets/images/onboarding/material.svg"
              alt="placeholder"
            />
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={closeGuide}>
            Got it!
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const OnboardingGuide = () => {
  const [isFirstTimeVisitGuideOpen, setIsFirstTimeVisitGuideOpen] =
    useState<boolean>(false);
  const { data: flags, isLoading } = useRecceServerFlag();

  useEffect(() => {
    if (!isLoading && flags) {
      const showOnboardingGuide = flags.show_onboarding_guide;
      const hasVisited = localStorage.getItem("hasVisited");
      if (!hasVisited && showOnboardingGuide) {
        setIsFirstTimeVisitGuideOpen(true);
        localStorage.setItem("hasVisited", "true");
      }
    }
  }, [flags, isLoading]);

  const closeGuide = () => {
    setIsFirstTimeVisitGuideOpen(false);
    markOnboardingCompleted();
  };

  if (isLoading) {
    return <></>;
  }

  return (
    <FirstTimeVisitGuide
      isGuideOpen={isFirstTimeVisitGuideOpen}
      closeGuide={closeGuide}
    />
  );
};

export default OnboardingGuide;
