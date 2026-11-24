"use client";

import { getTrackingUserId } from "@datarecce/ui/lib/api/track";
import { GoogleTagManager } from "@next/third-parties/google";
import { ReactNode, useEffect, useState } from "react";

/**
 * Load Google Tag Manager only for users who allow telemetry. The static export
 * renders this without GTM; the client adds it after reading the same
 * `recce_user_id` cookie that gates Amplitude and PostHog.
 */
export default function GoogleTagManagerGate({
  gtmId,
}: {
  gtmId: string;
}): ReactNode {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(getTrackingUserId() !== undefined);
  }, []);

  return allowed ? <GoogleTagManager gtmId={gtmId} /> : null;
}
