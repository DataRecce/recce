import { CopyIcon } from "@chakra-ui/icons";
import { Button } from "@chakra-ui/react";
import html2canvas from "html2canvas";
import { RefObject, useRef, useState } from "react";
import { useClipBoardToast } from "./useClipBoardToast";

export const highlightBoxShadow =
  "rgba(0, 0, 0, 0.25) 0px 54px 55px, rgba(0, 0, 0, 0.12) 0px -12px 30px, rgba(0, 0, 0, 0.12) 0px 4px 6px, rgba(0, 0, 0, 0.17) 0px 12px 13px, rgba(0, 0, 0, 0.09) 0px -3px 5px";

export interface HookOptions {
  imageType?: "png" | "jpeg";
  boardEffect?: boolean;
  shadowEffect?: boolean;
  borderStyle?: string;
  borderRadius?: string;
  onSuccess?: (blob: Blob) => void;
  onError?: (error: unknown) => void;
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
  imageType = "png",
  boardEffect = true,
  shadowEffect = false,
  borderStyle = "solid 1px #ccc",
  borderRadius = "10px",
  onSuccess,
  onError,
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

    function resetStyles() {
      nodeToUse.style.overflow = overflow;
      nodeToUse.style.border = border;
      nodeToUse.style.borderRadius = radius;
    }

    try {
      nodeToUse.style.overflow = "hidden";
      nodeToUse.style.border = boardEffect ? borderStyle : "";
      nodeToUse.style.borderRadius = boardEffect ? borderRadius : "";
      setStatus("loading");
      const canvas = await html2canvas(nodeToUse, {
        backgroundColor: null,
      });
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

export function useCopyToClipboardButton() {
  const { successToast, failToast } = useClipBoardToast();

  const { isLoading, toImage, ref } = useToBlob({
    imageType: "png",
    shadowEffect: true,
    onSuccess: async (blob) => {
      try {
        await copyBlobToClipboard(blob);
        successToast("Copied the query result as an image to clipboard");
      } catch (error) {
        failToast("Failed to copy image to clipboard", error);
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
