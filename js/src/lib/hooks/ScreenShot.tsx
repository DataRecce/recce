import { CopyIcon, InfoIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import html2canvas from "html2canvas";
import { toCanvas } from "html-to-image";
import { RefObject, useEffect, useRef, useState } from "react";
import { useClipBoardToast } from "./useClipBoardToast";
import { format } from "date-fns";
import saveAs from "file-saver";

export const IGNORE_SCREENSHOT_CLASS = "ignore-screenshot";

export const highlightBoxShadow =
  "rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px";

export interface HookOptions {
  renderLibrary?: "html2canvas" | "html-to-image";
  imageType?: "png" | "jpeg";
  backgroundColor?: string | null;
  boardEffect?: boolean;
  shadowEffect?: boolean;
  borderStyle?: string;
  borderRadius?: string;
  onSuccess?: (blob: Blob) => void;
  onError?: (error: unknown) => void;
  onClipboardNotDefined?: (blob: Blob) => void;
  ignoreElements?: (element: Element) => boolean;
}

export interface BlobHookReturn {
  status: "idle" | "loading" | "success" | "error";
  isLoading: boolean;
  isErrored: boolean;
  isSuccess: boolean;
  toImage: () => void;
  ref: RefObject<HTMLElement>;
}

export function useToBlob({
  renderLibrary = "html2canvas",
  imageType = "png",
  backgroundColor = null,
  boardEffect = true,
  shadowEffect = false,
  borderStyle = "solid 1px #ccc",
  borderRadius = "10px",
  onSuccess,
  onError,
  ignoreElements,
}: HookOptions) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const ref = useRef(null);

  const toImage = async () => {
    if (!ref.current) {
      console.error("No node to use for screenshot");
      setStatus("error");
      onError && onError(new Error("No node to use for screenshot"));
      return;
    }

    const nodeToUse = ((ref.current as any).element ||
      ref.current) as HTMLElement;
    const overflow = nodeToUse.style.overflow;
    const border = nodeToUse.style.border;
    const radius = nodeToUse.style.borderRadius;
    const background = nodeToUse.style.backgroundColor;

    function resetStyles() {
      nodeToUse.style.overflow = overflow;
      nodeToUse.style.border = border;
      nodeToUse.style.borderRadius = radius;
      nodeToUse.style.backgroundColor = background;
    }

    try {
      nodeToUse.style.overflow = "hidden";
      nodeToUse.style.border = boardEffect ? borderStyle : "";
      nodeToUse.style.borderRadius = boardEffect ? borderRadius : "";
      nodeToUse.style.backgroundColor = backgroundColor || "";

      // Add style to make images inline-block
      // ref: https://github.com/niklasvh/html2canvas/issues/2107#issuecomment-1316354455
      const style = document.createElement("style");
      document.head.appendChild(style);
      style.sheet?.insertRule(
        "body > div:last-child img { display: inline-block; }"
      );
      const filter = ignoreElements
        ? (n: HTMLElement) => !ignoreElements(n)
        : undefined;

      setStatus("loading");
      const canvas =
        renderLibrary === "html2canvas"
          ? await html2canvas(nodeToUse, {
              logging: false,
              backgroundColor: null,
              ignoreElements: ignoreElements,
            })
          : await toCanvas(nodeToUse, {
              filter: filter,
            }); // Use html-to-image for copy reactflow graph

      style.remove();
      const outputCanvas = shadowEffect
        ? document.createElement("canvas")
        : canvas;

      if (shadowEffect) {
        // Add shadow effect
        outputCanvas.width = canvas.width + 80;
        outputCanvas.height = canvas.height + 80;
        const ctx = outputCanvas.getContext("2d");
        if (ctx) {
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 10;
          ctx.shadowOffsetY = 10;
          ctx.drawImage(canvas, 40, 40);
        } else {
          console.error("Error getting canvas context");
          setStatus("error");
          onError &&
            onError(
              new Error("Error getting canvas context to add shadow effect")
            );
          return;
        }
      }

      outputCanvas.toBlob(async (blob) => {
        // Reset styles
        setStatus("success");
        onSuccess && blob && (await onSuccess(blob));
      }, `image/${imageType}`);
    } catch (error: unknown) {
      console.error("Error converting to image", error);
      setStatus("error");
      onError && onError(error);
      return;
    } finally {
      resetStyles();
    }
  };

  return {
    status,
    isLoading: status === "loading",
    isErrored: status === "error",
    isSuccess: status === "success",
    toImage,
    ref,
  };
}

export async function copyBlobToClipboard(blob: Blob) {
  if (!blob) {
    throw new Error("No blob to copy to clipboard");
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (error) {
    console.error("Error copying to clipboard", error);
    throw error;
  }
}

export function useCopyToClipboardButton(options?: HookOptions) {
  const { successToast, failToast } = useClipBoardToast();

  const { isLoading, toImage, ref } = useToBlob({
    imageType: "png",
    shadowEffect: true,
    backgroundColor: options?.backgroundColor || null,
    onSuccess: async (blob) => {
      try {
        await copyBlobToClipboard(blob);
        successToast("Copied the query result as an image to clipboard");
      } catch (error) {
        const message = (error as Error).message;
        if (
          message === "ClipboardItem is not defined" &&
          options?.onClipboardNotDefined
        ) {
          options.onClipboardNotDefined(blob);
        } else {
          failToast("Failed to copy image to clipboard", error);
        }
      }
    },
    onError: (error) => {
      console.error("Error taking screenshot", error);
      failToast("Failed to copy image to clipboard", error);
    },
  });

  function CopyToClipboardButton({
    imageType = "png",
    ...props
  }: {
    imageType?: "png" | "jpeg";
  }) {
    return (
      <Button
        size="sm"
        leftIcon={<CopyIcon />}
        style={{ position: "absolute", bottom: "16px", right: "16px" }}
        isLoading={isLoading}
        onMouseEnter={() => {
          if (ref.current) {
            const nodeToUse = ((ref.current as any).element ||
              ref.current) as HTMLElement;
            nodeToUse.style.boxShadow = highlightBoxShadow;
            nodeToUse.style.transition = "box-shadow 0.5s ease-in-out";
          }
        }}
        onMouseLeave={() => {
          if (ref.current) {
            const nodeToUse = ((ref.current as any).element ||
              ref.current) as HTMLElement;
            nodeToUse.style.boxShadow = "";
          }
        }}
        onClick={async () => {
          if (ref.current) {
            await toImage();
            const nodeToUse = ((ref.current as any).element ||
              ref.current) as HTMLElement;
            nodeToUse.style.boxShadow = "";
          }
        }}
      >
        Copy to Clipboard
      </Button>
    );
  }

  return {
    ref,
    CopyToClipboardButton,
  };
}

export function useImageBoardModal() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [imgBlob, setImgBlob] = useState<Blob>();

  function ImageBoardModal() {
    const [base64Img, setBase64Img] = useState<string>();

    useEffect(() => {
      if (!imgBlob) {
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(imgBlob);
      reader.onloadend = (e) => {
        if (e.target?.result && e.target?.result !== null) {
          setBase64Img(e.target.result as string);
        }
      };
    }, [setBase64Img]);

    const onDownload = () => {
      if (!imgBlob) {
        return;
      }
      const now = new Date();
      const fileName = `recce-screenshot-${format(
        now,
        "yyyy-MM-dd-HH-mm-ss"
      )}.png`;
      saveAs(imgBlob, fileName);
      onClose();
    };

    return (
      <Modal size="3xl" isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Screenshot Preview</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex px="10px" gap="10px" direction="column">
              <Flex alignItems="center" gap="5px">
                <InfoIcon color="red.600" />
                <Text fontWeight="500" display="inline">
                  Copy to the Clipboard
                </Text>{" "}
                is not supported in the current browser
              </Flex>
              <Text>Please download it directly</Text>
            </Flex>
            <Image src={base64Img} alt="screenshot" />
          </ModalBody>

          <ModalFooter>
            <Button mr={3} onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="blue" onClick={onDownload}>
              Download
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return {
    onOpen,
    setImgBlob,
    ImageBoardModal,
  };
}
