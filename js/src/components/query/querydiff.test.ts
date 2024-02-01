import { DataFrame } from "@/lib/api/types";
import { toDataDiffGrid } from "./querydiff";

test("query diff", () => {
  const base: DataFrame = {
    columns: [
      {
        name: "id",
        type: "integer",
      },
      {
        name: "name",
        type: "text",
      },
      {
        name: "value",
        type: "integer",
      },
    ],
    data: [
      [1, "Alice", 100],
      [2, "Bob", 200],
      [3, "Charlie", 300],
    ],
  };

  const current: DataFrame = {
    columns: [
      {
        name: "id",
        type: "integer",
      },
      {
        name: "name",
        type: "text",
      },
      {
        name: "value",
        type: "integer",
      },
    ],

    data: [
      [1, "Alice", 150],
      [2, "Bob", 200],
      [3, "Charlie", 350],
    ],
  };

  let result = toDataDiffGrid(base, current);
  expect(result?.rows).toStrictEqual([
    {
      _index: 1,
      status: "modified",
      base__id: 1,
      base__name: "Alice",
      base__value: 100,
      current__id: 1,
      current__name: "Alice",
      current__value: 150,
    },
    {
      _index: 2,
      base__id: 2,
      base__name: "Bob",
      base__value: 200,
      current__id: 2,
      current__name: "Bob",
      current__value: 200,
    },
    {
      _index: 3,
      status: "modified",
      base__id: 3,
      base__name: "Charlie",
      base__value: 300,
      current__id: 3,
      current__name: "Charlie",
      current__value: 350,
    },
  ]);
  expect(result?.columns.length).toBe(4);

  result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });
  expect(result?.rows).toStrictEqual([
    {
      id: 1,
      status: "modified",
      base__name: "Alice",
      base__value: 100,
      current__name: "Alice",
      current__value: 150,
    },
    {
      id: 2,
      base__name: "Bob",
      base__value: 200,
      current__name: "Bob",
      current__value: 200,
    },
    {
      status: "modified",
      id: 3,
      base__name: "Charlie",
      base__value: 300,
      current__name: "Charlie",
      current__value: 350,
    },
  ]);
  expect(result?.columns.length).toBe(3);
});
