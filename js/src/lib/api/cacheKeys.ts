export const cacheKeys = {
  rowCount: (model: string) => ["row_count", model],
  lineage: () => ["lineage"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
  runs: () => ["runs"],
  run: (runId: string) => ["runs", runId],
  runsAggregated: () => ["runs_aggregated"],
  flag: () => ["flag"],
  instanceInfo: () => ["instance_info"],
  user: () => ["user"],
};
