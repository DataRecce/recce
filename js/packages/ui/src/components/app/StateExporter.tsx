import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MuiTooltip from "@mui/material/Tooltip";
import { format } from "date-fns";
import saveAs from "file-saver";
import { PiExport } from "react-icons/pi";
import { exportState } from "../../api";
import { useRecceInstanceContext } from "../../contexts";
import { useApiConfig } from "../../hooks";
import { trackStateAction } from "../../lib/api/track";
import { toaster } from "../ui";

export function StateExporter() {
  const { featureToggles } = useRecceInstanceContext();
  const { apiClient } = useApiConfig();

  const handleExport = async () => {
    try {
      const jsonData = await exportState(apiClient);
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
    <MuiTooltip title="Export">
      <IconButton
        size="small"
        aria-label="Export state"
        onClick={async () => {
          await handleExport();
          trackStateAction({ name: "export" });
        }}
        disabled={featureToggles.disableExportStateFile}
      >
        <Box
          component={PiExport}
          sx={{ verticalAlign: "middle", width: "16px", height: "16px" }}
        />
      </IconButton>
    </MuiTooltip>
  );
}
