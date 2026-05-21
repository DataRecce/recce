"use client";

/**
 * Cache keys for TanStack Query.
 * Provides consistent query keys for API caching.
 */
export const cacheKeys = {
  rowCount: (model: string) => ["row_count", model],
  lineage: () => ["lineage"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
  checkEvents: (checkId: string) => ["checks", checkId, "events"],
  runs: () => ["runs"],
  run: (runId: string) => ["runs", runId],
  runsAggregated: () => ["runs_aggregated"],
  flag: () => ["flag"],
  instanceInfo: () => ["instance_info"],
  user: () => ["user"],
  /**
   * Cache key for inline profile-distribution runs. Keyed by model so
   * each schema row caches independently and PR 4's lineage pre-warm
   * can hydrate the cache without colliding across models.
   */
  profileDistribution: (model: string) => ["profile_distribution", model],
};
