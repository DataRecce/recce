import { toaster } from "@/components/ui/toaster";

export function useCheckToast() {
  function markedAsApprovedToast() {
    toaster.create({
      title: "Marked as approved",
      type: "success",
      duration: 2000,
    });
  }
  return {
    markedAsApprovedToast,
  };
}
