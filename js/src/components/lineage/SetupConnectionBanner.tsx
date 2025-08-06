import { HStack, Button, Text } from "@chakra-ui/react";

import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { PiInfo } from "react-icons/pi";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";

export default function SetupConnectionBanner() {
  const { featureToggles } = useRecceInstanceContext();

  if (featureToggles.mode !== "metadata only") {
    return null;
  }

  return (
    <div className="flex items-center w-full px-2 py-0.5 bg-cyan-50">
      <HStack flex="1" fontSize="sm" color="cyan.600">
        <PiInfo />
        <Text>Query functions disabled without a data warehouse connection.</Text>
        <Button
          bgColor="iochmara.400"
          size="2xs"
          onClick={() => {
            window.open(RECCE_SUPPORT_CALENDAR_URL, "_blank");
          }}>
          Connect to Data Warehouse
        </Button>
      </HStack>
    </div>
  );
}
