export const cacheKeys = {
  rowCount: (model: string) => ["row_count", model],
  adhocQuery: () => ["adhoc_query"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
};
