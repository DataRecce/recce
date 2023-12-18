export const cacheKeys = {
  rowCount: (model: string) => ["row_count", model],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
};
