"use client";

import { Button, Dialog, Image, Portal, useDisclosure } from "@chakra-ui/react";
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
  const { open, onOpen, onClose } = useDisclosure({ defaultOpen: !authed });
  const authStateCookieValue = (Cookies.get("authState") ?? "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(
    ignoreCookie ? "pending" : authStateCookieValue,
  );

  function handleAllCloses() {
    if (handleParentClose) {
      handleParentClose();
    }
    onClose();
  }

  const handleAllClosesCB = useCallback(() => {
    if (handleParentClose) {
      handleParentClose();
    }
    onClose();
  }, [handleParentClose, onClose]);

  const updateModalState = useCallback(() => {
    if (!authed && authState === "pending") {
      onOpen();
    } else if (authed) {
      handleAllClosesCB();
    }
  }, [authState, authed, handleAllClosesCB, onOpen]);

  useEffect(() => {
    updateModalState();
  }, [updateModalState]);

  if (authState === "ignored" && !ignoreCookie) {
    return null;
  }

  if (authed) {
    return null;
  }

  return (
    <Dialog.Root size="lg" placement="center" open={open} onOpenChange={handleAllCloses}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            {authState !== "authenticating" && (
              <Dialog.Header className="text-center" fontSize="2xl">
                Use Recce Cloud for Free
              </Dialog.Header>
            )}
            {authState === "authenticating" && (
              <Dialog.Header className="text-center">
                <Image className="mx-auto mb-2" src={(ReloadImage as StaticImageData).src} />
                <div>Reload to Finish</div>
              </Dialog.Header>
            )}
            {authState !== "authenticating" ? (
              <>
                <Dialog.Body className="space-y-2 font-light">
                  <ul className="list-inside list-disc">
                    <li>Share your work with teammates, no setup needed</li>
                    <li>Reviewers can access it with a link.</li>
                    <li>It’s recommended, but optional.</li>
                  </ul>
                </Dialog.Body>
                <Dialog.Footer>
                  <div className="flex w-full flex-col gap-2">
                    <Button
                      className="w-full !rounded-lg !font-medium"
                      colorScheme="brand"
                      onClick={async () => {
                        setAuthState("authenticating");
                        const { connection_url } = await connectToCloud();
                        // Open the connection URL in a new tab
                        window.open(connection_url, "_blank");
                      }}>
                      Use Recce Cloud <LuExternalLink />
                    </Button>
                    <Button
                      className="!rounded-lg !font-medium"
                      variant="solid"
                      colorScheme="gray"
                      size="sm"
                      onClick={() => {
                        handleAllCloses();
                      }}>
                      Skip
                    </Button>
                    <Button
                      className="!font-medium !text-black"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        Cookies.set("authState", "ignored", { expires: 30 });
                        setAuthState("ignored");
                      }}>
                      Snooze for 30 days
                    </Button>
                  </div>
                </Dialog.Footer>
              </>
            ) : (
              <>
                <Dialog.Body className="space-y-2 self-center font-light">
                  <p>Reload to complete connection to Recce Cloud</p>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    className="w-full"
                    colorScheme="brand"
                    onClick={() => {
                      window.location.reload();
                    }}>
                    Reload
                  </Button>
                </Dialog.Footer>
              </>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
