"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RiTerminalBoxLine } from "react-icons/ri";
import { useRecceInstanceInfo } from "../../contexts";
import { getSettingsUrl } from "../../utils";

export interface SetupConnectionGuideProps {
  /** URL for the support calendar booking (e.g., "https://cal.com/team/recce/chat") */
  supportCalendarUrl?: string;
}

/**
 * SetupConnectionGuide - displays guidance when data warehouse connection is not configured
 *
 * This component shows a guide to help users connect to a data warehouse
 * when query functions are disabled due to missing connection.
 */
export function SetupConnectionGuide({
  supportCalendarUrl = "https://cal.com/team/recce/chat",
}: SetupConnectionGuideProps) {
  const { data: instanceInfo } = useRecceInstanceInfo();

  return (
    <div className="flex flex-1 h-full min-h-0 m-2 p-4 bg-blue-50 rounded-lg shadow-md justify-center">
      <div className="w-4/5 flex flex-col overflow-y-auto gap-6 px-8 pb-8">
        <Stack alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              bgcolor: "background.paper",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: 2,
            }}
          >
            <Box
              component={RiTerminalBoxLine}
              sx={{ fontSize: 28, color: "iochmara.500" }}
            />
          </Box>
          <Typography variant="h5" sx={{ mt: 2 }}>
            Wait, there's more!
          </Typography>
          <Typography sx={{ fontSize: "1rem", textAlign: "center" }}>
            Query functions disabled without a{" "}
            <Typography component="span" sx={{ fontWeight: "bold" }}>
              data warehouse connection
            </Typography>
          </Typography>
        </Stack>
        <Stack sx={{ width: "50%", mt: 3, mx: "auto" }}>
          <Button
            color="iochmara"
            variant="contained"
            size="large"
            onClick={() => {
              window.open(
                getSettingsUrl(instanceInfo, supportCalendarUrl),
                "_blank",
              );
            }}
          >
            Connect to Data Warehouse
          </Button>
        </Stack>
      </div>
    </div>
  );
}

export default SetupConnectionGuide;
