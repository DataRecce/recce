import { NodeData } from "../lineagediff/lineagediff";
import { mergeColumns } from "./schemadiff";

function _schema(columns: { [key: string]: string }): NodeData["columns"] {
  const result: ReturnType<typeof _schema> = {};

  Object.entries(columns).forEach(([name, type]) => {
    result[name] = {
      name,
      type,
    };
  });

  return result;
}

test("column diff", () => {
  const base = _schema({
    id: "INT",
    user_id: "INT",
    name: "VARCHAR",
    age: "INT",
  });
  const current = _schema({
    id: "INT",
    fullname: "VARCHAR",
    lastname: "VARCHAR",
    age: "DECIMAL",
    name: "VARCHAR",
  });

  const result = mergeColumns(base, current) || {};
  expect(Object.keys(result)).toStrictEqual([
    "id",
    "user_id",
    "fullname",
    "lastname",
    "age",
    "name",
  ]);

  expect(result["id"]).toStrictEqual({
    name: "id",
    reordered: false,
    baseIndex: 1,
    baseType: "INT",
    currentIndex: 1,
    currentType: "INT",
  });
  expect(result["name"]).toStrictEqual({
    name: "name",
    reordered: true,
    baseIndex: 3,
    baseType: "VARCHAR",
    currentIndex: 5,
    currentType: "VARCHAR",
  });
  expect(result["age"]).toStrictEqual({
    name: "age",
    reordered: false,
    baseIndex: 4,
    baseType: "INT",
    currentIndex: 4,
    currentType: "DECIMAL",
  });
});
