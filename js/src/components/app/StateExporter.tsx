import { Icon, IconButton } from "@chakra-ui/react";
import { format } from "date-fns";
import saveAs from "file-saver";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { exportState } from "@/lib/api/state";
import { trackStateAction } from "@/lib/api/track";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { IconExport } from "../icons";

export function StateExporter() {
  const { featureToggles } = useRecceInstanceContext();

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
      toaster.create({
        title: "Export failed",
        description: String(error),
        type: "error",
        duration: 5000,
        closable: true,
      });
    }
  };

  return (
    <Tooltip content="Export">
      <IconButton
        size="sm"
        variant="plain"
        aria-label="Export state"
        onClick={async () => {
          await handleExport();
          trackStateAction({ name: "export" });
        }}
        disabled={featureToggles.disableExportStateFile}
      >
        <Icon as={IconExport} verticalAlign="middle" boxSize={"16px"} />
      </IconButton>
    </Tooltip>
  );
}
