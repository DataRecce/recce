import { toaster } from "@/components/ui/toaster";

export function useClipBoardToast() {
  function successToast(message: string) {
    toaster.create({
      description: message,
      type: "info",
      duration: 5000,
      closable: true,
    });
  }

  function failToast(title: string, error: any) {
    toaster.create({
      title: title,
      description: `${error}`,
      type: "error",
      duration: 5000,
      closable: true,
    });
  }

  return {
    successToast,
    failToast,
  };
}
