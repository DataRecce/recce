import { useToast } from "@chakra-ui/react";

export function useClipBoardToast() {
  const clipboardToast = useToast();

  function successToast(message: string) {
    clipboardToast({
      description: message,
      status: "info",
      variant: "left-accent",
      position: "bottom",
      duration: 5000,
      isClosable: true,
    });
  }

  function failToast(title: string, error: any) {
    clipboardToast({
      title: title,
      description: `${error}`,
      status: "error",
      variant: "left-accent",
      position: "bottom",
      duration: 5000,
      isClosable: true,
    });
  }

  return {
    successToast,
    failToast,
  };
}
