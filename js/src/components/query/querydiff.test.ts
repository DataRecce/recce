// Mock react-data-grid since tests don't need actual rendering
jest.mock("react-data-grid", () => ({
  textEditor: jest.fn(),
  CalculatedColumn: {},
  ColumnOrColumnGroup: {},
  RenderCellProps: {},
}));

import { DataFrame } from "@/lib/api/types";
import { toDataDiffGrid } from "./querydiff";

test("query diff", () => {
  const base: DataFrame = {
    columns: [
      {
        name: "id",
        key: "id",
        type: "integer",
      },
      {
        name: "name",
        key: "name",
        type: "text",
      },
      {
        name: "value",
        key: "value",
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
        key: "id",
        type: "integer",
      },
      {
        name: "name",
        key: "name",
        type: "text",
      },
      {
        name: "value",
        key: "value",
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
  expect(result.rows).toStrictEqual([
    {
      _index: 1,
      __status: "modified",
      base__id: 1,
      base__name: "Alice",
      base__value: 100,
      current__id: 1,
      current__name: "Alice",
      current__value: 150,
    },
    {
      _index: 2,
      __status: undefined,
      base__id: 2,
      base__name: "Bob",
      base__value: 200,
      current__id: 2,
      current__name: "Bob",
      current__value: 200,
    },
    {
      _index: 3,
      __status: "modified",
      base__id: 3,
      base__name: "Charlie",
      base__value: 300,
      current__id: 3,
      current__name: "Charlie",
      current__value: 350,
    },
  ]);
  expect(result.columns.length).toBe(4);

  result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });
  expect(result.rows).toStrictEqual([
    {
      _index: 3226095,
      id: 1,
      __status: "modified",
      base__name: "Alice",
      base__value: 100,
      current__name: "Alice",
      current__value: 150,
    },
    {
      _index: 3226096,
      id: 2,
      __status: undefined,
      base__name: "Bob",
      base__value: 200,
      current__name: "Bob",
      current__value: 200,
    },
    {
      __status: "modified",
      id: 3,
      _index: 3226097,
      base__name: "Charlie",
      base__value: 300,
      current__name: "Charlie",
      current__value: 350,
    },
  ]);
  expect(result.columns.length).toBe(3);
});

test("query diff changed only", () => {
  const base: DataFrame = {
    columns: [
      {
        name: "status",
        key: "status",
        type: "text",
      },
      {
        name: "c",
        key: "c",
        type: "integer",
      },
      {
        name: "x",
        key: "x",
        type: "integer",
      },
    ],
    data: [
      ["active", 16, 5],
      ["inactive", 7, 5],
    ],
  };

  const current: DataFrame = {
    columns: [
      {
        name: "status",
        key: "status",
        type: "text",
      },
      {
        name: "c",
        key: "c",
        type: "integer",
      },
      {
        name: "x",
        key: "x",
        type: "integer",
      },
    ],
    data: [
      ["active", 16, 5],
      ["inactive", 5, 5],
    ],
  };

  const result = toDataDiffGrid(base, current, {
    primaryKeys: ["status"],
    changedOnly: true,
  });
  expect(result.rows).toStrictEqual([
    {
      _index: 1317089290,
      status: "inactive",
      base__c: 7,
      base__x: 5,
      current__c: 5,
      current__x: 5,
      __status: "modified",
    },
  ]);
  expect(result.columns.length).toBe(2);
});

test("query diff changed only: show all columns if there is only removed records", () => {
  const base: DataFrame = {
    columns: [
      {
        name: "status",
        key: "status",
        type: "text",
      },
      {
        name: "c",
        key: "c",
        type: "integer",
      },
    ],
    data: [
      ["active", 16],
      ["inactive", 7],
      [null, 54],
    ],
  };

  const current: DataFrame = {
    columns: [
      {
        name: "status",
        key: "status",
        type: "text",
      },
      {
        name: "c",
        key: "c",
        type: "integer",
      },
    ],
    data: [
      ["active", 16],
      ["inactive", 7],
    ],
  };

  const result = toDataDiffGrid(base, current, {
    primaryKeys: ["status"],
    changedOnly: true,
  });
  expect(result.rows).toStrictEqual([
    {
      status: null,
      base__c: 54,
      __status: "removed",
      _index: 922765678,
    },
  ]);
  expect(result.columns.length).toBe(2);
});
