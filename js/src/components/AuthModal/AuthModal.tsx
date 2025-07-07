"use client";

import { Button, Dialog, Image, Portal, useDisclosure } from "@chakra-ui/react";
import { Dispatch, ReactNode, SetStateAction, useCallback, useEffect, useState } from "react";
import Cookies from "js-cookie";
import { LuExternalLink } from "react-icons/lu";
import ReloadImage from "public/imgs/reload-image.svg";
import { StaticImageData } from "next/image";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { connectToCloud } from "@/lib/api/connectToCloud";

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

interface AuthModalProps {
  handleParentClose?: Dispatch<SetStateAction<boolean>>;
  parentOpen?: boolean;
  ignoreCookie?: boolean;
}

export default function AuthModal({
  handleParentClose,
  parentOpen = false,
  ignoreCookie = false,
}: AuthModalProps): ReactNode {
  const { authed } = useRecceInstanceContext();
  const [open, setOpen] = useState(parentOpen || !authed);
  const authStateCookieValue = (Cookies.get("authState") ?? "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(
    ignoreCookie ? "pending" : authStateCookieValue,
  );

  if (authState === "ignored" && !ignoreCookie) {
    return null;
  }

  if (authed) {
    return null;
  }

  return (
    <Dialog.Root
      size="lg"
      placement="center"
      lazyMount
      open={open}
      onOpenChange={(e) => {
        setOpen(e.open);
        if (handleParentClose) {
          handleParentClose(e.open);
        }
      }}>
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
                      colorPalette="brand"
                      onClick={async () => {
                        setAuthState("authenticating");
                        const { connection_url } = await connectToCloud();
                        // Open the connection URL in a new tab
                        window.open(connection_url, "_blank");
                      }}>
                      Use Recce Cloud <LuExternalLink />
                    </Button>
                    <Dialog.ActionTrigger asChild>
                      <Button
                        className="!rounded-lg !font-medium"
                        variant="subtle"
                        colorPalette="gray"
                        size="sm">
                        Skip
                      </Button>
                    </Dialog.ActionTrigger>
                    <Dialog.ActionTrigger>
                      <Button
                        width="100%"
                        className="!rounded-lg !font-medium !text-black"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          Cookies.set("authState", "ignored", { expires: 30 });
                          setAuthState("ignored");
                        }}>
                        Snooze for 30 days
                      </Button>
                    </Dialog.ActionTrigger>
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
                    colorPalette="brand"
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
