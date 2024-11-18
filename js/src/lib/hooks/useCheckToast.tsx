import { useToast } from "@chakra-ui/react";

export function useCheckToast() {
  const toast = useToast();

  function markedAsCheckedToast() {
    toast({
      title: "Marked as checked",
      position: "bottom-right",
      status: "success",
      containerStyle: {
        fontSize: "sm",
      },
      duration: 2000,
    });
  }
  return {
    markedAsCheckedToast,
  };
}
