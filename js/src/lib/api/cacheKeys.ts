export const cacheKeys = {
  adhocQuery: () => ["adhoc_query"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
};
