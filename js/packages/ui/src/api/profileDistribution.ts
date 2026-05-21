/**
 * API surface for paired column-distribution runs (DRC-3390).
 *
 * Mirrors the shape of `profile.ts` — keeps the run-submission helpers
 * close to the typed payload definitions so the discriminated union from
 * `./types` lines up with what callers actually send/receive.
 *
 * The payload **types** themselves live in `./types/run.ts` so they can
 * participate in the canonical `Run` discriminated union. This file only
 * holds the submit helper.
 */

import type { ApiClient } from "../lib/fetchClient";
import { type SubmitOptions, submitRun } from "./runs";
import type {
  ProfileDistributionColumnResult,
  ProfileDistributionHistogramPayload,
  ProfileDistributionNullPayload,
  ProfileDistributionParams,
  ProfileDistributionResult,
  ProfileDistributionTopKPayload,
} from "./types/run";

/**
 * Fire a `profile_distribution` run and (by default) wait for its result.
 * Use `options.nowait = true` to fire-and-forget — useful for PR 4's
 * lineage pre-warm path.
 */
export async function submitProfileDistribution(
  params: ProfileDistributionParams,
  options: SubmitOptions | undefined,
  client: ApiClient,
) {
  return await submitRun("profile_distribution", params, options, client);
}

// Re-export the payload types from a single import-friendly location so
// consumers can ``import { ProfileDistributionHistogramPayload } from "@datarecce/ui/api"``.
export type {
  ProfileDistributionColumnResult,
  ProfileDistributionHistogramPayload,
  ProfileDistributionNullPayload,
  ProfileDistributionParams,
  ProfileDistributionResult,
  ProfileDistributionTopKPayload,
};

// ----------------------------------------------------------------------
// Payload narrowing helpers
// ----------------------------------------------------------------------
// These keep `kind`-switching out of cells; both the hook and the
// integration row use them.

/**
 * Type guard: the result envelope is the single-shot "this adapter
 * doesn't support the feature" reply. Frontend renders the unsupported
 * banner once per task, not per column.
 */
export function isUnsupportedResult(
  result: ProfileDistributionResult | undefined,
): result is ProfileDistributionResult & { status: "unsupported" } {
  return result?.status === "unsupported";
}

/** Type guard: a per-column slot carries a histogram payload. */
export function isHistogramPayload(
  payload: ProfileDistributionColumnResult | undefined,
): payload is ProfileDistributionHistogramPayload {
  return payload?.kind === "histogram";
}

/** Type guard: a per-column slot carries a top-K payload. */
export function isTopKPayload(
  payload: ProfileDistributionColumnResult | undefined,
): payload is ProfileDistributionTopKPayload {
  return payload?.kind === "topk";
}

/**
 * Type guard: a per-column slot represents a per-column failure (the
 * column raised during the probe but the rest of the task succeeded).
 * Frontend skips rendering for these — no spinner, no error chrome.
 */
export function isNullPayload(
  payload: ProfileDistributionColumnResult | undefined,
): payload is ProfileDistributionNullPayload {
  return payload?.kind === null;
}
