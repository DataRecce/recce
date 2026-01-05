import {
  cacheKeys,
  getRecceInstanceInfo,
  type RecceInstanceInfo,
} from "@datarecce/ui/api";
import { useQuery } from "@tanstack/react-query";
import { useApiConfig } from "./ApiConfigContext";

export const useRecceInstanceInfo = () => {
  const { apiClient } = useApiConfig();

  return useQuery<RecceInstanceInfo>({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: () => getRecceInstanceInfo(apiClient),
  });
};
