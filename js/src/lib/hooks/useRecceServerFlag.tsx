import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../api/cacheKeys";
import { getServerFlag, RecceServerFlags } from "../api/flag";

export const useRecceServerFlag = () => {
  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: getServerFlag,
  });
};
