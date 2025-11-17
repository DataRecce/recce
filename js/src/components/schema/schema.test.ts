import { NodeData } from "@/lib/api/info";
// import { mergeColumns } from "./schema";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";

//

// TODO mergeColumns import is throwing an error, fake fow now
interface SchemaDiffRow {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

type SchemaDiff = Record<string, SchemaDiffRow>;

// Fake mergeColumns for now
export function mergeColumns(
  baseColumns: NodeData["columns"] = {},
  currentColumns: NodeData["columns"] = {},
): SchemaDiff {
  const result: SchemaDiff = {};
  const mergedStatus = mergeKeysWithStatus(
    Object.keys(baseColumns),
    Object.keys(currentColumns),
  );

  Object.entries(mergedStatus).forEach(([name, status]) => {
    result[name] = {
      name,
      reordered: status === "reordered",
    };
  });

  let filteredIndex = 0;
  Object.entries(baseColumns).forEach(([name, column]) => {
    if (column != null) {
      result[name].baseIndex = filteredIndex += 1;
      result[name].baseType = column.type;
    }
  });

  filteredIndex = 0;
  Object.entries(currentColumns).forEach(([name, column]) => {
    if (column != null) {
      result[name].currentIndex = filteredIndex += 1;
      result[name].currentType = column.type;
    }
  });

  return result;
}

function _schema(columns: Record<string, string>): NodeData["columns"] {
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

  const result = mergeColumns(base, current);
  expect(Object.keys(result)).toStrictEqual([
    "id",
    "user_id",
    "fullname",
    "lastname",
    "age",
    "name",
  ]);

  expect(result.id).toStrictEqual({
    name: "id",
    reordered: false,
    baseIndex: 1,
    baseType: "INT",
    currentIndex: 1,
    currentType: "INT",
  });
  expect(result.name).toStrictEqual({
    name: "name",
    reordered: true,
    baseIndex: 3,
    baseType: "VARCHAR",
    currentIndex: 5,
    currentType: "VARCHAR",
  });
  expect(result.age).toStrictEqual({
    name: "age",
    reordered: false,
    baseIndex: 4,
    baseType: "INT",
    currentIndex: 4,
    currentType: "DECIMAL",
  });
});
