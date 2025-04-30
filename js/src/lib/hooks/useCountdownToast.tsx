import { UseToastOptions, useToast, ToastId } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

const COUNTDOWN_CONFIG = {
  TOAST_ID: "lifetime-countdown",
  WARNING_THRESHOLD: 60, // seconds before expiry to show warning
  UPDATE_INTERVAL: 1000, // milliseconds
  MESSAGE: (seconds: number) => `The server will be closed in ${seconds} seconds.`,
  STYLE: {
    fontFamily: "monospace",
  },
} as const;

interface CountdownToastOptions {
  position?: UseToastOptions["position"];
  variant?: UseToastOptions["variant"];
  status?: UseToastOptions["status"];
}

/**
 * Hook to manage countdown toast notifications for server lifetime
 * @param lifetimeExpiredAt - Date when the server will expire
 * @param options - Optional toast UI configuration
 */
export function useCountdownToast(
  lifetimeExpiredAt: Date | undefined,
  options: CountdownToastOptions = {},
) {
  const countdownToast = useToast();
  const countdownToastIdRef = useRef<ToastId>();
  const countdownIntervalRef = useRef<NodeJS.Timeout>();

  const toastOptions = useMemo<UseToastOptions>(
    () => ({
      position: options.position ?? "bottom-right",
      variant: options.variant ?? "left-accent",
      status: options.status ?? "warning",
      duration: null,
      isClosable: true,
      containerStyle: COUNTDOWN_CONFIG.STYLE,
    }),
    [options.position, options.variant, options.status],
  );

  const calculateRemainingSeconds = useCallback(() => {
    if (!lifetimeExpiredAt) return 0;

    const now = new Date();
    const remaining = Math.floor((lifetimeExpiredAt.getTime() - now.getTime()) / 1000);
    return Math.max(0, remaining); // Ensure we don't return negative values
  }, [lifetimeExpiredAt]);

  const cleanupToast = useCallback(() => {
    if (countdownToastIdRef.current) {
      countdownToast.close(countdownToastIdRef.current);
      countdownToastIdRef.current = undefined;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = undefined;
    }
  }, [countdownToast]);

  const updateToast = useCallback(() => {
    if (!countdownToastIdRef.current) return;

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds <= 0) {
      cleanupToast();
      return;
    }

    countdownToast.update(countdownToastIdRef.current, {
      ...toastOptions,
      description: COUNTDOWN_CONFIG.MESSAGE(remainingSeconds),
    });
  }, [countdownToast, toastOptions, calculateRemainingSeconds, cleanupToast]);

  const showToast = useCallback(() => {
    if (!lifetimeExpiredAt) return;

    // Cleanup any existing toast before showing new one
    cleanupToast();

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds <= 0) return;

    countdownToastIdRef.current = countdownToast({
      id: COUNTDOWN_CONFIG.TOAST_ID,
      description: COUNTDOWN_CONFIG.MESSAGE(remainingSeconds),
      ...toastOptions,
    });

    countdownIntervalRef.current = setInterval(updateToast, COUNTDOWN_CONFIG.UPDATE_INTERVAL);
  }, [
    lifetimeExpiredAt,
    countdownToast,
    calculateRemainingSeconds,
    toastOptions,
    updateToast,
    cleanupToast,
  ]);

  useEffect(() => {
    if (!lifetimeExpiredAt) return;

    const remainingSeconds = calculateRemainingSeconds();
    if (remainingSeconds - COUNTDOWN_CONFIG.WARNING_THRESHOLD < 0) {
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
