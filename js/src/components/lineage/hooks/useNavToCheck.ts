import type { Check } from "@datarecce/ui/api";
import { useCallback } from "react";
import { useAppLocation } from "@/lib/hooks/useAppRouter";

/**
 * Hook that provides navigation to a check's detail page.
 *
 * Uses the app router to navigate to /checks/?id={check_id}
 *
 * @returns A function that navigates to the given check's detail page
 */
export const useNavToCheck = () => {
  const [, setLocation] = useAppLocation();
  return useCallback(
    (check: Check) => {
      if (check.check_id) {
        setLocation(`/checks/?id=${check.check_id}`);
      }
    },
    [setLocation],
  );
};
