import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Check } from "../../../api";

/**
 * Hook that provides navigation to a check's detail page.
 *
 * Uses the app router to navigate to /checks/?id={check_id}
 *
 * @returns A function that navigates to the given check's detail page
 */
export const useNavToCheck = () => {
  const router = useRouter();
  return useCallback(
    (check: Check) => {
      if (check.check_id) {
        router.push(`/checks/?id=${check.check_id}`);
      }
    },
    [router.push],
  );
};
