import { getNeighborSet } from "./graph";

test("Neighbor set", () => {
  /*
   * A -> B -> D -> E
   *   -> C
   */
  const dag: Record<string, string[]> = {
    A: ["B", "C"],
    B: ["D"],
    C: [],
    D: ["E"],
    E: [],
  };

  const getNeighbors = (id: string) => dag[id];

  expect(getNeighborSet(["A", "B", "D"], getNeighbors)).toEqual(
    new Set(["A", "B", "C", "D", "E"]),
  );
  expect(getNeighborSet(["B"], getNeighbors)).toEqual(new Set(["B", "D", "E"]));
  expect(getNeighborSet(["B", "C"], getNeighbors)).toEqual(
    new Set(["B", "C", "D", "E"]),
  );
  expect(getNeighborSet(["A"], getNeighbors, 1)).toEqual(
    new Set(["A", "B", "C"]),
  );
  expect(getNeighborSet(["B", "D"], getNeighbors, 1)).toEqual(
    new Set(["B", "D", "E"]),
  );
});
