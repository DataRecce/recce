"use client";

import MuiAlert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

/**
 * One-time banner shown when the dbt adapter can't run the paired-
 * distribution feature at all (e.g. Postgres, MySQL, SQLite,
 * SQL Server < 2022). The backend signals this with a single
 * `{status: "unsupported", reason: ...}` envelope rather than a per-
 * column payload. DRC-3390 PR 3.
 *
 * The banner is intentionally low-key (MUI Alert "info" severity, dense
 * padding) so it doesn't dominate the schema view when the feature is
 * flag-enabled but unavailable on this warehouse. It carries the
 * backend's `reason` string so users know *why* — usually "adapter
 * lacks native HLL / approx_percentile / approx_top_k".
 */

export interface ProfileDistributionUnsupportedBannerProps {
  /** Backend-provided explanation. Falls back to a generic message. */
  reason?: string;
  /** Optional adapter-type for a more specific message (e.g. "postgres"). */
  adapterType?: string;
  /** Optional CSS class override. */
  className?: string;
}

const DEFAULT_REASON =
  "This warehouse doesn't expose native HLL / approx-percentile / approx-top-k aggregates, so paired column distributions aren't available here.";

export function ProfileDistributionUnsupportedBanner({
  reason,
  adapterType,
  className,
}: ProfileDistributionUnsupportedBannerProps) {
  const message = reason ?? DEFAULT_REASON;
  const title = adapterType
    ? `Paired distributions unavailable on ${adapterType}`
    : "Paired distributions unavailable on this adapter";
  return (
    <MuiAlert
      severity="info"
      variant="outlined"
      className={className}
      sx={{
        fontSize: "0.75rem",
        py: 0.5,
        px: 1,
        "& .MuiAlert-message": { py: 0.5 },
      }}
      role="status"
      aria-live="polite"
      data-testid="profile-distribution-unsupported-banner"
    >
      <AlertTitle sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.25 }}>
        {title}
      </AlertTitle>
      {message}
    </MuiAlert>
  );
}
