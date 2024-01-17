export const cacheKeys = {
  allRowCount: () => ["row_count"],
  rowCount: (model: string) => ["row_count", model],
  lineage: () => ["lineage"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
};
