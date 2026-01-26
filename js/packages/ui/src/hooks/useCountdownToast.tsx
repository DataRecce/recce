/**
 * @recce-migration NOT_APPLICABLE
 *
 * This hook is specific to Recce OSS and should not be migrated to @datarecce/ui.
 *
 * Reason: Server lifetime countdown is an OSS-specific feature for local
 * development servers. It shows remaining time before auto-shutdown.
 * Cloud deployments do not have this concept.
 *
 * If this changes in the future, consider:
 * - This is unlikely to be needed in cloud/shared contexts
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTimeout } from "usehooks-ts";
import { toaster } from "../components/ui/Toaster";

const COUNTDOWN_CONFIG = {
  TOAST_ID: "lifetime-countdown",
  WARNING_THRESHOLD: 60, // seconds before expiry to show warning
  UPDATE_INTERVAL: 1000, // milliseconds
  MESSAGE: (seconds: number) =>
    `The server will be closed in ${seconds} seconds.`,
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
    const remaining = Math.floor(
      (lifetimeExpiredAt.getTime() - now.getTime()) / 1000,
    );
    return Math.max(0, remaining); // Ensure we don't return negative values
  }, [lifetimeExpiredAt]);

  const cleanupToast = useCallback(() => {
    if (countdownToastId != null) {
      countdownToast.remove(countdownToastId);
      setCountdownToastId(null);
    }
  }, [countdownToastId]);

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
  }, [countdownToastId, calculateRemainingSeconds, cleanupToast]);

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

    countdownIntervalRef.current = setInterval(
      updateToast,
      COUNTDOWN_CONFIG.UPDATE_INTERVAL,
    );
  }, [lifetimeExpiredAt, calculateRemainingSeconds, updateToast, cleanupToast]);

  // Calculate delay for showing toast
  const remainingSeconds = calculateRemainingSeconds();
  const delay = lifetimeExpiredAt
    ? Math.max(0, remainingSeconds - COUNTDOWN_CONFIG.WARNING_THRESHOLD) * 1000
    : null;

  // Use useTimeout hook to schedule toast display
  useTimeout(showToast, delay);

  // Cleanup effect
  useEffect(() => {
    return cleanupToast;
  }, [cleanupToast]);
}
