import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../api/cacheKeys";
import { getRecceInstanceInfo, RecceInstanceInfo } from "../api/instanceInfo";
import { useApiConfig } from "./ApiConfigContext";

export const useRecceInstanceInfo = () => {
  const { apiClient } = useApiConfig();

  return useQuery<RecceInstanceInfo>({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: () => getRecceInstanceInfo(apiClient),
  });
};
