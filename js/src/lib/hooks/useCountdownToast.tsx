import { toaster } from "@/components/ui/toaster";
import { useCallback, useEffect, useRef, useState } from "react";

const COUNTDOWN_CONFIG = {
  TOAST_ID: "lifetime-countdown",
  WARNING_THRESHOLD: 60, // seconds before expiry to show warning
  UPDATE_INTERVAL: 1000, // milliseconds
  MESSAGE: (seconds: number) => `The server will be closed in ${seconds} seconds.`,
  STYLE: {
    fontFamily: "monospace",
  },
} as const;

/**
 * Hook to manage countdown toast notifications for server lifetime
 * @param lifetimeExpiredAt - Date when the server will expire
 */
export function useCountdownToast(lifetimeExpiredAt: Date | undefined) {
  const countdownToast = toaster;
  const [countdownToastId, setCountdownToastId] = useState<string | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout>(undefined);

  const calculateRemainingSeconds = useCallback(() => {
    if (!lifetimeExpiredAt) return 0;

    const now = new Date();
    const remaining = Math.floor((lifetimeExpiredAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining); // Ensure we don't return negative values
  }, [lifetimeExpiredAt]);

  const cleanupToast = useCallback(() => {
    if (countdownToastId != null) {
      countdownToast.remove(countdownToastId);
      setCountdownToastId(null);
    }
  }, [countdownToast, countdownToastId]);

  const updateToast = useCallback(() => {
    if (countdownToastId == null) return;

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds <= 0) {
      cleanupToast();
      return;
    }

    countdownToast.update(countdownToastId, {
      description: COUNTDOWN_CONFIG.MESSAGE(remainingSeconds),
    });
  }, [countdownToastId, calculateRemainingSeconds, countdownToast, cleanupToast]);

  const showToast = useCallback(() => {
    if (!lifetimeExpiredAt) return;

    // Cleanup any existing toast before showing new one
    cleanupToast();

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds <= 0) return;

    setCountdownToastId(
      countdownToast.create({
        id: COUNTDOWN_CONFIG.TOAST_ID,
        description: COUNTDOWN_CONFIG.MESSAGE(remainingSeconds),
      }),
    );

    countdownIntervalRef.current = setInterval(updateToast, COUNTDOWN_CONFIG.UPDATE_INTERVAL);
  }, [lifetimeExpiredAt, countdownToast, calculateRemainingSeconds, updateToast, cleanupToast]);

  useEffect(() => {
    if (!lifetimeExpiredAt) return;

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds - COUNTDOWN_CONFIG.WARNING_THRESHOLD < 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast();
    } else {
      const timeoutId = setTimeout(
        showToast,
        (remainingSeconds - COUNTDOWN_CONFIG.WARNING_THRESHOLD) * 1000,
      );
      return () => {
        clearTimeout(timeoutId);
        cleanupToast();
      };
    }

    return cleanupToast;
  }, [lifetimeExpiredAt, calculateRemainingSeconds, showToast, cleanupToast]);
}
