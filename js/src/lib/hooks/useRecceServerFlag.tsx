import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../api/cacheKeys";
import { getServerFlag, RecceServerFlags } from "../api/flag";
import { useApiConfig } from "./ApiConfigContext";

export const useRecceServerFlag = () => {
  const { apiClient } = useApiConfig();

  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: () => getServerFlag(apiClient),
  });
};
