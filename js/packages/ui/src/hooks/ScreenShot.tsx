import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MuiDialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { format } from "date-fns";
import saveAs from "file-saver";
import { toCanvas } from "html-to-image";
import React, {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IoClose } from "react-icons/io5";
import { PiCopy, PiInfo } from "react-icons/pi";
import type { DataGridHandle } from "../primitives";
import { colors } from "../theme";
import { useClipBoardToast } from "./useClipBoardToast";

// Dynamic import for html2canvas-pro (externalized to consuming app)
type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

const loadHtml2Canvas = async (): Promise<Html2CanvasFn> => {
  const module = await import("html2canvas-pro");
  return module.default as Html2CanvasFn;
};

// Type to represent DataGridHandle which may have an element property
type DataGridRefType = DataGridHandle & { element?: HTMLElement };

// Helper function to safely extract HTMLElement from DataGridHandle
const getHTMLElementFromRef = (
  refCurrent: DataGridRefType,
): HTMLElement | undefined => {
  // DataGridHandle might have an 'element' property containing the actual HTMLElement
  if ("element" in refCurrent) {
    return refCurrent.element;
  }
  // Otherwise, treat the ref itself as the HTMLElement
  return refCurrent as unknown as HTMLElement;
};

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
  onSuccess?: () => void;
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
  ref: RefObject<HTMLElement | null>;
}

export function useCopyToClipboard({
  renderLibrary = "html2canvas",
  imageType = "png",
  backgroundColor = null,
  boardEffect = true,
  shadowEffect = false,
  borderStyle = `solid 1px ${colors.neutral[300]}`,
  borderRadius = "10px",
  onSuccess,
  onError,
  ignoreElements,
}: HookOptions) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const ref = useRef<DataGridRefType>(null);

  // ImageDownloadModal is used for browsers that don't support ClipboardItem
  const { onOpen, setImgBlob, ImageDownloadModal } = useImageDownloadModal();

  const toImage = async () => {
    if (!ref.current) {
      console.error("No node to use for screenshot");
      throw new Error("No node to use for screenshot");
    }

    const nodeToUse = getHTMLElementFromRef(ref.current);
    if (!nodeToUse) {
      console.error("Could not get HTMLElement from ref");
      throw new Error("Could not get HTMLElement from ref");
    }
    const overflow = nodeToUse.style.overflow;
    const border = nodeToUse.style.border;
    const radius = nodeToUse.style.borderRadius;
    const background = nodeToUse.style.backgroundColor;
    const heigh = nodeToUse.style.height;

    function resetStyles() {
      // nodeToUse is verified non-null before resetStyles is defined
      // Capture in local const to satisfy linter
      const node = nodeToUse;
      if (node) {
        node.style.overflow = overflow;
        node.style.border = border;
        node.style.borderRadius = radius;
        node.style.backgroundColor = background;
        node.style.height = heigh;
      }
    }

    try {
      nodeToUse.style.overflow = "hidden";
      nodeToUse.style.border = boardEffect ? borderStyle : "";
      nodeToUse.style.borderRadius = boardEffect ? borderRadius : "";
      nodeToUse.style.backgroundColor = backgroundColor ?? colors.neutral[100];
      // after firefox v125, html2canvas can't get the correct style height of the element to clone
      nodeToUse.style.height = `${String(nodeToUse.offsetHeight)}px`;

      // Add style to make images inline-block
      // ref: https://github.com/niklasvh/html2canvas/issues/2107#issuecomment-1316354455
      const style = document.createElement("style");
      document.head.appendChild(style);
      style.sheet?.insertRule(
        "body > div:last-child img { display: inline-block; }",
      );
      const filter = ignoreElements
        ? (n: HTMLElement) => !ignoreElements(n)
        : undefined;

      setStatus("loading");
      let canvas: HTMLCanvasElement;
      if (renderLibrary === "html2canvas") {
        const html2canvas = await loadHtml2Canvas();
        canvas = await html2canvas(nodeToUse, {
          logging: false,
          backgroundColor: backgroundColor ?? colors.neutral[100],
          ignoreElements: ignoreElements,
        });
      } else {
        canvas = await toCanvas(nodeToUse, {
          filter: filter,
        }); // Use html-to-image for copy reactflow graph
      }

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
          throw new Error("Error getting canvas context to add shadow effect");
        }
      }

      const response = await fetch(outputCanvas.toDataURL());
      return await response.blob();
    } catch (error: unknown) {
      console.error("Error converting to image", error);
      throw error;
    } finally {
      resetStyles();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [`image/${imageType}`]: toImage() }),
      ]);
      setStatus("success");
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      if ((error as Error).message === "ClipboardItem is not defined") {
        const blob = await toImage();
        setImgBlob(blob);
        onOpen();
        setStatus("success");
      } else {
        setStatus("error");
        console.error("Error copying to clipboard", error);
        if (onError) {
          onError(error);
        }
      }
    }
  };

  return {
    status,
    isLoading: status === "loading",
    isErrored: status === "error",
    isSuccess: status === "success",
    copyToClipboard,
    ImageDownloadModal,
    ref,
  };
}

export function useCopyToClipboardButton(options?: HookOptions) {
  const { successToast, failToast } = useClipBoardToast();

  const { isLoading, copyToClipboard, ImageDownloadModal, ref } =
    useCopyToClipboard({
      imageType: "png",
      shadowEffect: true,
      backgroundColor: options?.backgroundColor ?? colors.neutral[100],
      onSuccess: () => {
        successToast("Copied the query result as an image to clipboard");
      },
      onError: (error) => {
        console.error("Error taking screenshot", error);
        failToast("Failed to copy image to clipboard", error);
      },
    });

  const onMouseEnter = useCallback(() => {
    if (ref.current) {
      const nodeToUse = getHTMLElementFromRef(ref.current);
      if (nodeToUse) {
        nodeToUse.style.boxShadow = highlightBoxShadow;
        nodeToUse.style.transition = "box-shadow 0.5s ease-in-out";
      }
    }
  }, [ref]);

  const onMouseLeave = useCallback(() => {
    if (ref.current) {
      const nodeToUse = getHTMLElementFromRef(ref.current);
      if (nodeToUse) {
        nodeToUse.style.boxShadow = "";
      }
    }
  }, [ref]);

  const onCopyToClipboard = useCallback(async () => {
    if (ref.current) {
      await copyToClipboard();
      const nodeToUse = getHTMLElementFromRef(ref.current);
      if (nodeToUse) {
        nodeToUse.style.boxShadow = "";
      }
    } else {
      failToast("Failed to copy image to clipboard", "No content to copy");
    }
  }, [ref, copyToClipboard, failToast]);

  function CopyToClipboardButton({
    imageType = "png",
    ...props
  }: {
    imageType?: "png" | "jpeg";
  }) {
    return (
      <>
        <Button
          size="small"
          sx={{ position: "absolute", bottom: 16, right: 16 }}
          disabled={isLoading}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onCopyToClipboard}
          startIcon={<PiCopy />}
          {...props}
        >
          Copy to Clipboard
        </Button>
        <ImageDownloadModal />
      </>
    );
  }

  return {
    ref,
    CopyToClipboardButton,
    onMouseEnter,
    onMouseLeave,
    onCopyToClipboard,
  };
}

export function useImageDownloadModal() {
  const [open, setOpen] = useState(false);
  const [imgBlob, setImgBlob] = useState<Blob>();

  const onOpen = () => setOpen(true);
  const onClose = () => setOpen(false);

  function ImageDownloadModal() {
    const [base64Img, setBase64Img] = useState<string>();

    useEffect(() => {
      if (!imgBlob) {
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(imgBlob);
      reader.onloadend = (e) => {
        if (e.target?.result != null) {
          setBase64Img(e.target.result as string);
        }
      };
    }, []);

    const onDownload = () => {
      if (!imgBlob) {
        return;
      }
      const now = new Date();
      const fileName = `recce-screenshot-${format(now, "yyyy-MM-dd-HH-mm-ss")}.png`;
      saveAs(imgBlob, fileName);
      onClose();
    };

    return (
      <MuiDialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Screenshot Preview</DialogTitle>
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: "grey.500",
          }}
        >
          <IoClose />
        </IconButton>
        <DialogContent>
          <Stack sx={{ px: "10px", gap: "10px" }}>
            <Stack direction="row" alignItems="center" spacing="5px">
              <Box component={PiInfo} sx={{ color: "error.main" }} />
              <Typography sx={{ fontWeight: 500, display: "inline" }}>
                Copy to the Clipboard
              </Typography>{" "}
              is not supported in the current browser
            </Stack>
            <Typography>Please download it directly</Typography>
          </Stack>
          <Box
            component="img"
            src={base64Img}
            alt="screenshot"
            sx={{ maxWidth: "100%" }}
          />
        </DialogContent>

        <DialogActions>
          <Button sx={{ mr: 1.5 }} onClick={onClose}>
            Close
          </Button>
          <Button color="iochmara" variant="contained" onClick={onDownload}>
            Download
          </Button>
        </DialogActions>
      </MuiDialog>
    );
  }

  return {
    onOpen,
    setImgBlob,
    ImageDownloadModal,
  };
}
