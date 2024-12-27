import { useQuery } from "@tanstack/react-query";
import { getServerFlag, RecceServerFlags } from "../api/flag";
import { cacheKeys } from "../api/cacheKeys";

export const useRecceServerFlag = () => {
  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: getServerFlag,
  });
};
