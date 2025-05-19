import {
  Button,
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

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

export default function AuthModal(): ReactNode {
  const { authed } = useRecceInstanceContext();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const authStateCookieValue = (Cookies.get("authState") ?? "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(authStateCookieValue);

  const updateModalState = useCallback(() => {
    console.log(authed, isOpen);
    if (!authed && !isOpen && authState === "pending") {
      onOpen();
    } else if (authed && isOpen && authState !== "authenticating") {
      onClose();
    }
  }, [authState, authed, isOpen, onClose, onOpen]);

  updateModalState();

  return (
    <Modal size="3xl" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        {authState !== "authenticating" && <ModalHeader>Connect to Recce Cloud</ModalHeader>}
        {authState === "authenticating" && <ModalHeader>Restart Recce Server</ModalHeader>}
        <ModalCloseButton
          onClick={() => {
            setAuthState("canceled");
            onClose();
          }}
        />
        {authState !== "authenticating" ? (
          <>
            <ModalBody className="space-y-2 font-light">
              <p>
                Easily and securely share your data validation checks with your team by connecting
                to Recce Cloud!
              </p>
              <p>
                Reviewers and stakeholders can access your checks directly in the Cloud. Plus,
                everything is protected with SOC 2 Type 1 security compliance.
              </p>
              <p className="!mt-4">
                Connecting is recommended for better collaboration, but is completely optional.
              </p>
            </ModalBody>
            <ModalFooter>
              <Link
                href={`${PUBLIC_CLOUD_WEB_URL}/signin?callbackUrl=relaunch`}
                target="_blank"
                onClick={() => {
                  setAuthState("authenticating");
                }}>
                <Button colorScheme="blue" mr={3} rightIcon={<LuExternalLink />}>
                  Sign in
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAuthState("canceled");
                  onClose();
                }}>
                Skip
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  Cookies.set("authState", "ignored", { expires: 30 });
                  setAuthState("ignored");
                }}>
                Snooze for 30 days
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalBody className="space-y-2 font-light">
              <p>Relaunch Recce Server with the API Token and refresh this page to continue</p>
            </ModalBody>
            <ModalFooter>
              <Button
                colorScheme="blue"
                onClick={() => {
                  window.location.reload();
                }}>
                Refresh Page
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
