export function getNeighborSet(
  nodeIds: string[],
  getNeighbors: (id: string) => string[],
  degree = 1000,
) {
  const neighborSet = new Set<string>();
  const visited: Record<string, number | undefined> = {};

  const dfs = (id: string, currentDegree: number) => {
    if (currentDegree < 0) {
      return;
    }
    if (visited[id] != null && visited[id] >= currentDegree) {
      return;
    }
    visited[id] = currentDegree;

    const neighbors = getNeighbors(id);

    for (const neighborId of neighbors) {
      dfs(neighborId, currentDegree - 1);
    }

    neighborSet.add(id);
  };

  for (const nodeId of nodeIds) {
    dfs(nodeId, degree);
  }

  return neighborSet;
}

export function union<T>(...sets: Set<T>[]) {
  const unionSet = new Set<T>();

  sets.forEach((set) => {
    set.forEach((key) => {
      unionSet.add(key);
    });
  });

  return unionSet;
}

export function intersect<T>(...sets: Set<T>[]) {
  if (sets.length === 0) {
    return new Set<T>();
  }

  let intersection = new Set<T>(sets[0]);

  for (const set of sets) {
    intersection = new Set([...intersection].filter((x) => set.has(x)));
  }

  return intersection;
}
