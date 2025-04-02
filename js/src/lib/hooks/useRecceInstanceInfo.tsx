import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../api/cacheKeys";
import { getRecceInstanceInfo, RecceInstanceInfo } from "../api/instanceInfo";

export const useRecceInstanceInfo = () => {
  return useQuery<RecceInstanceInfo>({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: getRecceInstanceInfo,
  });
};
