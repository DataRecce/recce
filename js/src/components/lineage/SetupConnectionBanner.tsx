import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { PiInfo } from "react-icons/pi";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceInstanceInfo } from "@/lib/hooks/useRecceInstanceInfo";
import { getSettingsUrl } from "@/lib/utils/urls";

export default function SetupConnectionBanner() {
  const { featureToggles } = useRecceInstanceContext();
  const { data: instanceInfo } = useRecceInstanceInfo();

  if (featureToggles.mode !== "metadata only") {
    return null;
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        px: 1,
        py: 0.25,
        bgcolor: "cyan.50",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ flex: 1, fontSize: "0.875rem", color: "cyan.600" }}
        spacing={1}
      >
        <Box component={PiInfo} />
        <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
          Query functions disabled without a data warehouse connection.
        </Typography>
        <Button
          sx={{ bgcolor: "iochmara.400" }}
          size="small"
          variant="contained"
          onClick={() => {
            window.open(getSettingsUrl(instanceInfo), "_blank");
          }}
        >
          Connect to Data Warehouse
        </Button>
      </Stack>
    </Box>
  );
}
