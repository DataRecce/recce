import {
  Button,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import { ReactNode, useCallback, useState } from "react";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import Cookies from "js-cookie";
import { LuExternalLink } from "react-icons/lu";
import Link from "next/link";
import { PUBLIC_CLOUD_WEB_URL } from "@/lib/const";
import ReloadImage from "public/imgs/reload-image.svg";
import { StaticImageData } from "next/image";

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

interface AuthModalProps {
  handleParentClose?: () => void;
}

export default function AuthModal({ handleParentClose }: AuthModalProps): ReactNode {
  const { authed } = useRecceInstanceContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const authStateCookieValue = (Cookies.get("authState") ?? "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(authStateCookieValue);

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

  updateModalState();

  return (
    <Modal size="xl" isCentered isOpen={isOpen} onClose={handleAllCloses}>
      <ModalOverlay />
      <ModalContent>
        {authState !== "authenticating" && <ModalHeader>Use Recce Cloud for Free</ModalHeader>}
        {authState === "authenticating" && (
          <ModalHeader className="text-center">
            <Image className="mx-auto mb-2" src={(ReloadImage as StaticImageData).src} />
            <div>Reload to Finish</div>
          </ModalHeader>
        )}
        <ModalCloseButton
          onClick={() => {
            setAuthState("canceled");
            handleAllCloses();
          }}
        />
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
                <Link
                  className="w-full"
                  href={`${PUBLIC_CLOUD_WEB_URL}/connect-to-cloud`}
                  target="_blank"
                  onClick={() => {
                    setAuthState("authenticating");
                  }}>
                  <Button className="w-full" colorScheme="brand" rightIcon={<LuExternalLink />}>
                    Use Recce Cloud
                  </Button>
                </Link>
                <Button
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
