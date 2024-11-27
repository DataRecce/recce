import { useToast } from "@chakra-ui/react";

export function useCheckToast() {
  const toast = useToast();

  function markedAsApprovedToast() {
    toast({
      title: "Marked as approved",
      position: "bottom-right",
      status: "success",
      containerStyle: {
        fontSize: "sm",
      },
      duration: 2000,
    });
  }
  return {
    markedAsApprovedToast,
  };
}
