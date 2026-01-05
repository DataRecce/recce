import {
  cacheKeys,
  getServerFlag,
  type RecceServerFlags,
} from "@datarecce/ui/api";
import { useQuery } from "@tanstack/react-query";
import { useApiConfig } from "./ApiConfigContext";

export const useRecceServerFlag = () => {
  const { apiClient } = useApiConfig();

  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: () => getServerFlag(apiClient),
  });
};
