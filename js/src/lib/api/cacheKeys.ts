export const cacheKeys = {
  lineage: () => ["lineage"],
  checks: () => ["checks", "list"],
  check: (checkId: string) => ["checks", checkId],
};
