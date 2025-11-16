export function mergeKeys(_base: string[], _curr: string[]) {
  // Merge keys from base, target tables. Unlike default union, it preserves the order for column rename, added, removed.
  const base = [..._base];
  const curr = [..._curr];

  const results: string[] = [];
  while (base.length > 0 && curr.length > 0) {
    if (results.includes(base[0])) {
      base.shift();
    } else if (results.includes(curr[0])) {
      curr.shift();
    } else if (base[0] === curr[0]) {
      results.push(base[0]);
      base.shift();
      curr.shift();
    } else if (curr.includes(base[0])) {
      const idx = curr.indexOf(base[0]);
      for (let i = 0; i < idx; i++) {
        if (!results.includes(curr[i])) {
          results.push(curr[i]);
        }
      }
      results.push(base[0]);
      base.shift();
      curr.splice(0, idx + 1);
    } else {
      results.push(base[0]);
      base.shift();
    }
  }

  base.forEach((key) => {
    if (!results.includes(key)) {
      results.push(key);
    }
  });

  curr.forEach((key) => {
    if (!results.includes(key)) {
      results.push(key);
    }
  });

  return results;
}

type MergeStatus = "added" | "removed" | "reordered" | undefined;

export function mergeKeysWithStatus(
  _base: string[],
  _curr: string[],
): Record<string, MergeStatus> {
  const merged = mergeKeys(_base, _curr);
  const result: ReturnType<typeof mergeKeysWithStatus> = {};

  for (const item of merged) {
    if (!_base.includes(item)) {
      result[item] = "added";
    } else if (!_curr.includes(item)) {
      result[item] = "removed";
    } else {
      result[item] = undefined;
    }
  }

  // reorder case
  const baseIndexMap: Record<string, number | undefined> = {};
  _base.forEach((item, index) => {
    baseIndexMap[item] = index;
  });
  let last = -1;
  for (const item of merged) {
    const curr = baseIndexMap[item];
    if (curr == null) {
      continue;
    }

    if (curr > last) {
      last = curr;
    } else {
      result[item] = "reordered";
    }
  }

  return result;
}
