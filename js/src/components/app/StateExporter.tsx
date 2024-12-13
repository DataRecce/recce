import { exportState } from "@/lib/api/state";
import { Icon, IconButton, Tooltip, useToast } from "@chakra-ui/react";
import { format } from "date-fns";
import saveAs from "file-saver";
import { TfiExport } from "react-icons/tfi";
import { IconExport } from "../icons";

export function StateExporter() {
  const toast = useToast();

  const handleExport = async () => {
    try {
      const jsonData = await exportState();
      const jsonString = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });

      const now = new Date();
      const fileName = `recce-state-${format(now, "yyyy-MM-dd-HH-mm-ss")}.json`;

      saveAs(blob, fileName);
    } catch (error) {
      console.error("Export failed", error);
      toast({
        title: "Export failed",
        description: `${error}`,
        status: "error",
        variant: "left-accent",
        position: "bottom",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Tooltip label="Export">
      <IconButton
        pt="6px"
        variant="unstyled"
        aria-label="Export state"
        onClick={handleExport}
        icon={<Icon as={IconExport} boxSize={"1.2em"} color="gray.500" />}
      />
    </Tooltip>
  );
}
