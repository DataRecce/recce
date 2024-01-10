import { toDataDiffGrid } from "./querydiff";

test("query diff", () => {
  const base = {
    schema: {
      fields: [
        {
          name: "index",
          type: "integer",
        },
        {
          name: "id",
          type: "integer",
        },
        {
          name: "name",
          type: "string",
        },
        {
          name: "value",
          type: "integer",
        },
      ],
      primaryKey: ["index"],
      pandas_version: "1.4.0",
    },
    data: [
      {
        index: 0,
        id: 1,
        name: "Alice",
        value: 100,
      },
      {
        index: 1,
        id: 2,
        name: "Bob",
        value: 200,
      },
      {
        index: 2,
        id: 3,
        name: "Charlie",
        value: 300,
      },
    ],
  };

  const current = {
    schema: {
      fields: [
        {
          name: "index",
          type: "integer",
        },
        {
          name: "id",
          type: "integer",
        },
        {
          name: "name",
          type: "string",
        },
        {
          name: "value",
          type: "integer",
        },
      ],
      primaryKey: ["index"],
      pandas_version: "1.4.0",
    },
    data: [
      {
        index: 0,
        id: 1,
        name: "Alice",
        value: 150,
      },
      {
        index: 1,
        id: 2,
        name: "Bob",
        value: 200,
      },
      {
        index: 2,
        id: 3,
        name: "Charlie",
        value: 350,
      },
    ],
  };

  const result = toDataDiffGrid(base, current);

  expect(result?.rows).toStrictEqual([
    {
      index: 0,
      status: "modified",
      base__id: 1,
      base__name: "Alice",
      base__value: 100,
      current__id: 1,
      current__name: "Alice",
      current__value: 150,
    },
    {
      index: 1,
      status: "modified",
      base__id: 2,
      base__name: "Bob",
      base__value: 200,
      current__id: 2,
      current__name: "Bob",
      current__value: 200,
    },
    {
      index: 2,
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
});
