"use client";

import {
  Button,
  Dialog,
  Image,
  Link,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import Cookies from "js-cookie";
import { StaticImageData } from "next/image";
import ReloadImage from "public/imgs/reload-image.svg";
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";
import { LuExternalLink } from "react-icons/lu";
import { connectToCloud } from "@/lib/api/connectToCloud";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

type AuthState = "authenticating" | "pending" | "canceled" | "ignored";

interface AuthModalProps {
  handleParentClose?: Dispatch<SetStateAction<boolean>>;
  parentOpen?: boolean;
  ignoreCookie?: boolean;
  variant?: "auth" | "enable-share" | "user-profile";
}

export default function AuthModal({
  handleParentClose,
  parentOpen = false,
  ignoreCookie = false,
  variant = "auth",
}: AuthModalProps): ReactNode {
  const { authed } = useRecceInstanceContext();
  const [open, setOpen] = useState(parentOpen || !authed);

  // Cookie handling only for auth variant
  const authStateCookieValue = (Cookies.get("authState") ??
    "pending") as AuthState;
  const [authState, setAuthState] = useState<AuthState>(
    ignoreCookie ? "pending" : authStateCookieValue,
  );

  if (authState === "ignored" && !ignoreCookie) {
    return null;
  }

  if (authed) {
    return null;
  }

  // Content configuration based on variant
  const contents = {
    auth: {
      title: "Configure Cloud Token",
      action: "Get token and configure",
    },
    "enable-share": {
      title: "Enable Sharing with Cloud",
      action: "Enable sharing",
    },
    "user-profile": {
      title: "Configure Cloud Token",
      action: "Get token and configure",
    },
  };

  const content = contents[variant];

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
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content borderRadius="2xl">
            {authState !== "authenticating" && (
              <Dialog.Header className="text-center" fontSize="2xl">
                <Dialog.Title>{content.title}</Dialog.Title>
              </Dialog.Header>
            )}
            {authState !== "authenticating" ? (
              <>
                <Dialog.Body className="space-y-2 font-light">
                  <Text>
                    To enable sharing, get your token from Recce Cloud and
                    launch your local instance with it.
                  </Text>
                  <ul className="list-inside list-disc">
                    <li>Share your instance with teammates via Recce Cloud.</li>
                    <li>
                      Your instance will be securely and freely hosted for
                      sharing.
                    </li>
                    {variant === "auth" && (
                      <li>This step is recommended but optional.</li>
                    )}
                  </ul>
                  <Text display="flex" gap={1}>
                    More directions
                    <Link
                      variant="underline"
                      color="blue.500"
                      _focus={{
                        outline: "none",
                      }}
                      href="https://cloud.datarecce.io/connect-to-cloud"
                      target="_blank"
                    >
                      here <LuExternalLink />
                    </Link>
                  </Text>
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
                      }}
                    >
                      {content.action} <LuExternalLink />
                    </Button>
                    <Dialog.ActionTrigger asChild>
                      <Button
                        className="!rounded-lg !font-medium"
                        variant="subtle"
                        colorPalette="gray"
                        size="sm"
                      >
                        {variant === "auth" ? "Skip" : "Cancel"}
                      </Button>
                    </Dialog.ActionTrigger>
                    {variant === "auth" && (
                      <Dialog.ActionTrigger asChild>
                        <Button
                          width="100%"
                          className="!rounded-lg !font-medium !text-black"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            Cookies.set("authState", "ignored", {
                              expires: 30,
                            });
                            setAuthState("ignored");
                          }}
                        >
                          Snooze for 30 days
                        </Button>
                      </Dialog.ActionTrigger>
                    )}
                  </div>
                </Dialog.Footer>
              </>
            ) : (
              <>
                <Dialog.Body className="space-y-2 self-center font-light">
                  <VStack gap={4} paddingTop="1rem">
                    <Image
                      className="mx-auto mb-2"
                      h="6rem"
                      fit="contain"
                      src={(ReloadImage as StaticImageData).src}
                    />
                    <Text fontSize="2xl" fontWeight="medium">
                      Reload to Finish
                    </Text>
                    <Text>Reload to complete connection to Recce Cloud</Text>
                  </VStack>
                </Dialog.Body>
                <Dialog.Footer>
                  <Button
                    className="w-full"
                    colorPalette="brand"
                    onClick={() => {
                      window.location.reload();
                    }}
                  >
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
