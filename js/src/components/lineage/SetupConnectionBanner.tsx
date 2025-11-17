import { Button, HStack, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { PiInfo } from "react-icons/pi";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { getRecceInstanceInfo } from "@/lib/api/instanceInfo";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { getSettingsUrl } from "@/lib/utils/urls";

export default function SetupConnectionBanner() {
  const { featureToggles } = useRecceInstanceContext();
  const { data: instanceInfo } = useQuery({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: getRecceInstanceInfo,
  });

  if (featureToggles.mode !== "metadata only") {
    return null;
  }

  return (
    <div className="flex items-center w-full px-2 py-0.5 bg-cyan-50">
      <HStack flex="1" fontSize="sm" color="cyan.600">
        <PiInfo />
        <Text>
          Query functions disabled without a data warehouse connection.
        </Text>
        <Button
          bgColor="iochmara.400"
          size="2xs"
          onClick={() => {
            window.open(getSettingsUrl(instanceInfo), "_blank");
          }}
        >
          Connect to Data Warehouse
        </Button>
      </HStack>
    </div>
  );
}
