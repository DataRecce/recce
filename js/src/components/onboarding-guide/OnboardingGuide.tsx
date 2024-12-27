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
  Text,
  Divider,
  Flex,
  Link,
} from "@chakra-ui/react";
import React from "react";
import { useEffect, useState } from "react";
import { markOnboardingCompleted } from "@/lib/api/flag";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { InfoOutlineIcon } from "@chakra-ui/icons";

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

const SingleEnvGuide = ({ isGuideOpen, closeGuide }: GuideProps) => {
  return (
    <Modal isOpen={isGuideOpen} onClose={closeGuide} scrollBehavior={"inside"}>
      <ModalOverlay />
      <ModalContent maxW="40vw" h="50vh">
        <ModalHeader>All node in one environment</ModalHeader>
        <ModalCloseButton />
        <Divider />
        <ModalBody>
          <Stack spacing={4}>
            <Text>
              The lineage shows all nodes since only one environment (target) so
              no modified node.
            </Text>
            <Flex bg="blue.100" color="blue.700">
              <InfoOutlineIcon mt="10px" ml="5px" />
              <Text margin="5px" paddingX="3px">
                Want to see modified nodes? Get the target-base prepared.{" "}
                <Link
                  textDecor="underline"
                  isExternal
                  href="https://datarecce.io/docs"
                >
                  See instruction here.
                </Link>
              </Text>
            </Flex>
          </Stack>
        </ModalBody>
        <Divider />
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
  const [isSingleEnvGuideOpen, setISSingleEnvGuideOpen] =
    useState<boolean>(false);
  const { data: flags, isLoading } = useRecceServerFlag();

  useEffect(() => {
    if (!isLoading && flags) {
      const showOnboardingGuide = flags.show_onboarding_guide;
      const singleEnvMode = flags.onboarding_mode;
      if (singleEnvMode && showOnboardingGuide) {
        setISSingleEnvGuideOpen(true);
        return;
      }

      const hasVisited = localStorage.getItem("hasVisited");
      if (!hasVisited && showOnboardingGuide) {
        setIsFirstTimeVisitGuideOpen(true);
        localStorage.setItem("hasVisited", "true");
      }
    }
  }, [flags, isLoading]);

  const closeGuide = () => {
    setIsFirstTimeVisitGuideOpen(false);
    setISSingleEnvGuideOpen(false);
    markOnboardingCompleted();
  };

  if (isLoading) {
    return <></>;
  }

  return (
    <>
      <FirstTimeVisitGuide
        isGuideOpen={isFirstTimeVisitGuideOpen}
        closeGuide={closeGuide}
      />
      <SingleEnvGuide
        isGuideOpen={isSingleEnvGuideOpen}
        closeGuide={closeGuide}
      />
    </>
  );
};

export default OnboardingGuide;
