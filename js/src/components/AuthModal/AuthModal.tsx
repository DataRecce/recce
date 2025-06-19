"use client";

import {
  Button,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { ReactNode, useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { LuExternalLink } from "react-icons/lu";
import ReloadImage from "public/imgs/reload-image.svg";
import { StaticImageData } from "next/image";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { connectToCloud } from "@/lib/api/connectToCloud";

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

interface AuthModalProps {
  handleParentClose?: () => void;
  ignoreCookie?: boolean;
}

export default function AuthModal({
  handleParentClose,
  ignoreCookie = false,
}: AuthModalProps): ReactNode {
  const { authed } = useRecceInstanceContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const authStateCookieValue = (Cookies.get("authState") ?? "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(
    ignoreCookie ? "pending" : authStateCookieValue,
  );

  const updateModalState = useCallback(() => {
    if (!authed && !isOpen && authState === "pending") {
      onOpen();
    } else if (authed && isOpen && authState !== "authenticating") {
      if (handleParentClose) {
        handleParentClose();
      }
      onClose();
    }
  }, [authState, authed, handleParentClose, isOpen, onClose, onOpen]);

  function handleAllCloses() {
    if (handleParentClose) {
      handleParentClose();
    }
    onClose();
  }

  useEffect(() => {
    updateModalState();
  }, [updateModalState]);

  if (authState === "ignored" && !ignoreCookie) {
    return null;
  }

  return (
    <Modal size="lg" isCentered isOpen={isOpen} onClose={handleAllCloses}>
      <ModalOverlay />
      <ModalContent borderRadius="2xl">
        {authState !== "authenticating" && (
          <ModalHeader className="text-center" fontSize="2xl">
            Use Recce Cloud for Free
          </ModalHeader>
        )}
        {authState === "authenticating" && (
          <ModalHeader className="text-center">
            <Image className="mx-auto mb-2" src={(ReloadImage as StaticImageData).src} />
            <div>Reload to Finish</div>
          </ModalHeader>
        )}
        {authState !== "authenticating" ? (
          <>
            <ModalBody className="space-y-2 font-light">
              <ul className="list-inside list-disc">
                <li>Share your work with teammates, no setup needed</li>
                <li>Reviewers can access it with a link.</li>
                <li>It’s recommended, but optional.</li>
              </ul>
            </ModalBody>
            <ModalFooter>
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="w-full !rounded-lg !font-medium"
                  colorScheme="brand"
                  rightIcon={<LuExternalLink />}
                  onClick={async () => {
                    setAuthState("authenticating");
                    const { connection_url } = await connectToCloud();
                    // Open the connection URL in a new tab
                    window.open(connection_url, "_blank");
                  }}>
                  Use Recce Cloud
                </Button>
                <Button
                  className="!rounded-lg !font-medium"
                  variant="solid"
                  colorScheme="gray"
                  size="sm"
                  onClick={() => {
                    setAuthState("canceled");
                    handleAllCloses();
                  }}>
                  Skip
                </Button>
                <Button
                  className="!font-medium !text-black"
                  variant="link"
                  size="sm"
                  onClick={() => {
                    handleAllCloses();
                    Cookies.set("authState", "ignored", { expires: 30 });
                    setAuthState("ignored");
                  }}>
                  Snooze for 30 days
                </Button>
              </div>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody className="space-y-2 self-center font-light">
              <p>Reload to complete connection to Recce Cloud</p>
            </ModalBody>
            <ModalFooter>
              <Button
                className="w-full"
                colorScheme="brand"
                onClick={() => {
                  window.location.reload();
                }}>
                Reload
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
