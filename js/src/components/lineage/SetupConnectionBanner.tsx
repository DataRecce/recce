import { HStack, Button, Text } from "@chakra-ui/react";

import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { PiInfo } from "react-icons/pi";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { useQuery } from "@tanstack/react-query";
import { getRecceInstanceInfo } from "@/lib/api/instanceInfo";

export default function SetupConnectionBanner() {
  const { featureToggles } = useRecceInstanceContext();
  const { data: instanceInfo } = useQuery({
    queryKey: ["instanceInfo"],
    queryFn: getRecceInstanceInfo,
  });

  if (featureToggles.mode !== "metadata only") {
    return null;
  }

  const getSettingsUrl = () => {
    const orgName = instanceInfo?.organization_name;
    if (orgName) {
      return `/organization/${orgName}/settings`;
    }
    return RECCE_SUPPORT_CALENDAR_URL; // fallback
  };

  return (
    <div className="flex items-center w-full px-2 py-0.5 bg-cyan-50">
      <HStack flex="1" fontSize="sm" color="cyan.600">
        <PiInfo />
        <Text>Query functions disabled without a data warehouse connection.</Text>
        <Button
          bgColor="iochmara.400"
          size="2xs"
          onClick={() => {
            window.open(getSettingsUrl(), "_blank");
          }}>
          Connect to Data Warehouse
        </Button>
      </HStack>
    </div>
  );
}
