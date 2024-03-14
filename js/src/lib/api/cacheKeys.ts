export const cacheKeys = {
  rowCount: (model: string) => ["row_count", model],
  lineage: () => ["lineage"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
  run: (runId: string) => ["runs", runId],
  runsAggregated: () => ["runs_aggregated"],
};
