# CLL frontend state and fetching

Status: accepted for [DRC-3021](https://linear.app/recce/issue/DRC-3021/cll-frontend-refactor-centralize-cll-data-in-one-store-separated-from), 2026-08-26.

## Decision

The frontend keeps fetching column-level lineage (CLL) slices per interaction. It does not fetch and retain the complete CLL map.

The backend still owns complete-map construction and caching. That removes repeated SQL parsing and manifest traversal from per-node requests without making every browser download the whole map. The frontend can revisit complete-map transport if production telemetry shows that cached slice latency is material and browser memory remains acceptable on large projects.

## State boundary

`useCllState` is the single frontend owner of:

- the current `ColumnLineageData` result;
- CLL request, cache-patch, and stale-response ownership;
- the optional-input history stack;
- CLL interaction generations;
- published node, column, and whole-model impact snapshots.

`LineageViewOss` continues to own presentation and layout state: view options, change-analysis presentation mode, model focus, model-focus history, selection, React Flow nodes and edges, and layout generations. It commits a fetched CLL result only after the existing layout-generation guard accepts it.

[DRC-3315](https://linear.app/recce/issue/DRC-3315/split-lineageviewcontext-into-stable-dynamic-slices-or-migrate-to) owns state-library selection and `LineageViewContext` slicing. DRC-3021 deliberately introduces neither a state library nor context-value restructuring.

## Release-flag gate

The April release-flag blocker is obsolete for this data refactor. The remaining single-environment onboarding flag controls lineage affordances and messaging in the controls; it does not choose the CLL request, cache-patch, history, or result-storage path. Extracting those mechanics therefore does not require removing the flag.

## Payload measurement

The source fixture is `cll-full-map.json` from closed draft [DataRecce/recce PR #1244](https://github.com/DataRecce/recce/pull/1244). The large measurement cycles the captured fixture's real node, column, and map objects, prefixes their identifiers, and matches the anonymized project shape reported in that PR: 1,796 total nodes, 15,520 columns, and 17,316 map entries (including 1,207 models).

Measurements ran locally with Node.js. Raw bytes use compact `JSON.stringify`, gzip bytes use Node's default `zlib.gzipSync`, parse time is the median of 12 warm `JSON.parse` runs, and retained heap is measured after parsing and forced garbage collection.

| Fixture | Nodes | Columns | Map entries | Raw JSON | gzip | Parse median | Retained heap |
|---|---:|---:|---:|---:|---:|---:|---:|
| Captured jaffle full map | 99 | 804 | 903 | 885,797 B | 57,315 B | — | — |
| Count-matched synthetic large map | 1,796 | 15,520 | 17,316 | 15,639,943 B | 1,379,393 B | 33.36 ms | 19,391,736 B |

These results are directional, not a production browser benchmark: they use a warm local Node runtime, omit network latency, and reproduce the proprietary project's counts and captured object shapes rather than its source payload. They are sufficient for the transport choice because the browser cost is paid up front even when a user inspects only one column.

### Reproduction

The measurement used Node.js v26.7.0 and fixture commit `329a59989d94e83c74a021a6d2799e8e0bc4b2a1`. The fixture's SHA-256 is `ffd66a9ff511e51d6374df003a652e59345c0e5e45eeaef7faf59b09e38868f1`.

```bash
cll_fixture_path=$(mktemp)
git show 329a59989d94e83c74a021a6d2799e8e0bc4b2a1:js/packages/ui/src/components/lineage/__tests__/fixtures/cll-full-map.json > "$cll_fixture_path"
CLL_FIXTURE_PATH="$cll_fixture_path" node --expose-gc <<'NODE'
const fs = require("node:fs");
const zlib = require("node:zlib");

const sourceJson = fs.readFileSync(process.env.CLL_FIXTURE_PATH, "utf8");
const source = JSON.parse(sourceJson).current;

function cycle(entries, count) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const [key, value] = entries[index % entries.length];
      const prefix = `synthetic_${index}_`;
      const copy = structuredClone(value);
      if (copy && typeof copy === "object" && "id" in copy) {
        copy.id = prefix + copy.id;
      }
      return [prefix + key, copy];
    }),
  );
}

function cycleMap(entries, count) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const [key, value] = entries[index % entries.length];
      const prefix = `synthetic_${index}_`;
      return [
        prefix + key,
        Array.isArray(value) ? value.map((item) => prefix + item) : value,
      ];
    }),
  );
}

const payload = {
  current: {
    nodes: cycle(Object.entries(source.nodes), 1796),
    columns: cycle(Object.entries(source.columns), 15520),
    parent_map: cycleMap(Object.entries(source.parent_map), 17316),
    child_map: cycleMap(Object.entries(source.child_map), 17316),
  },
};
const json = JSON.stringify(payload);
const parseTimes = [];
for (let index = 0; index < 12; index++) {
  const started = process.hrtime.bigint();
  JSON.parse(json);
  parseTimes.push(Number(process.hrtime.bigint() - started) / 1e6);
}
parseTimes.sort((left, right) => left - right);

global.gc();
const heapBefore = process.memoryUsage().heapUsed;
global.parsedCllPayload = JSON.parse(json);
global.gc();
const heapAfter = process.memoryUsage().heapUsed;

console.log({
  sourceRawBytes: Buffer.byteLength(sourceJson),
  sourceGzipBytes: zlib.gzipSync(sourceJson).length,
  syntheticRawBytes: Buffer.byteLength(json),
  syntheticGzipBytes: zlib.gzipSync(json).length,
  parseMedianMs: parseTimes[Math.floor(parseTimes.length / 2)],
  retainedHeapBytes: heapAfter - heapBefore,
});
NODE
rm "$cll_fixture_path"
```

The complete-map option would trade cached slice requests for about 15.6 MB of JSON allocation and about 19.4 MB of retained heap at the measured large shape. Since complete-map computation is already cached server-side, that trade is not justified without evidence from production click-latency and browser-memory telemetry.
