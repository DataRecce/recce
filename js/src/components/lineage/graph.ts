export function getNeighborSet(
  nodeIds: string[],
  getNeighbors: (id: string) => string[],
  degree: number = 1000
) {
  const neighborSet: Set<string> = new Set();
  const visited: { [id: string]: number } = {};

  const dfs = (id: string, currentDegree: number) => {
    if (currentDegree < 0) {
      return;
    }
    if (visited[id] !== undefined && visited[id] >= currentDegree) {
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
