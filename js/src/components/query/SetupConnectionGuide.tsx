import { Button, Heading, Icon, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { RiTerminalBoxLine } from "react-icons/ri";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { getRecceInstanceInfo } from "@/lib/api/instanceInfo";
import { getSettingsUrl } from "@/lib/utils/urls";

export default function SetupConnectionGuide() {
  const { data: instanceInfo } = useQuery({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: getRecceInstanceInfo,
  });

  return (
    <div className="flex flex-1 h-full min-h-0 m-2 p-4 bg-blue-50 rounded-lg shadow-md justify-center">
      <div className="w-4/5 flex flex-col overflow-y-auto gap-6 px-8 pb-8">
        <div className="flex flex-col items-center gap-4">
          <div className="p-2 bg-white rounded-full flex items-center justify-center shadow-md">
            <Icon as={RiTerminalBoxLine} boxSize={7} color="blue.500" />
          </div>
          <Heading mt="4" size="lg">
            Wait, there's more!
          </Heading>
          <Text fontSize="md" textAlign="center">
            Query functions disabled without a{" "}
            <Text fontWeight="bold" as="span">
              data warehouse connection
            </Text>
          </Text>
        </div>
        <div className="w-1/2 flex flex-col mt-6 mx-auto">
          <Button
            colorPalette="blue"
            size="lg"
            onClick={() => {
              window.open(getSettingsUrl(instanceInfo), "_blank");
            }}
          >
            Connect to Data Warehouse
          </Button>
        </div>
      </div>
    </div>
  );
}
