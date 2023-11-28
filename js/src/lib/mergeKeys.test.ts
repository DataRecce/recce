import { mergeKeys, mergeKeysWithStatus } from "./mergeKeys";

test("should merge keys from base and target arrays while preserving order", () => {
  const base = ["id", "name", "age", "email"];
  const curr = ["name", "age", "city"];

  const result = mergeKeysWithStatus(base, curr);

  // The expected result after merging is: ['id', 'name', 'age', 'city', 'email']
  expect(result).toEqual({
    id: "removed",
    name: undefined,
    age: undefined,
    email: "removed",
    city: "added",
  });
});

test("should merge keys from base and target arrays while preserving order (case 2)", () => {
  const base = ["id", "name", "age", "city"];
  const curr = ["id", "fullname", "age", "city"];

  const result = mergeKeysWithStatus(base, curr);
  const expected = {
    id: undefined,
    name: "removed",
    fullname: "added",
    age: undefined,
    city: undefined,
  };

  expect(Object.keys(result)).toEqual(Object.keys(expected));
  expect(result).toEqual(expected);
});

test("should handle empty arrays", () => {
  const base = [] as string[];
  const curr = ["name", "age", "city"];

  const result = mergeKeys(base, curr);

  // The expected result is the target array itself when the base array is empty
  expect(result).toEqual(curr);
});

test("should handle duplicate keys in base and target arrays", () => {
  const base = ["id", "name", "age", "email"];
  const curr = ["name", "age", "id", "city", "name"];

  const result = mergeKeysWithStatus(base, curr);
  const expected = {
    name: undefined,
    age: undefined,
    id: "reordered",
    email: "removed",
    city: "added",
  };

  expect(Object.keys(result)).toEqual(Object.keys(expected));
  expect(result).toEqual(expected);
});

test("should handle reoder keys", () => {
  const base = ["address", "id", "name", "age", "city"];
  const curr = ["email", "city", "age", "name", "id"];

  const result = mergeKeysWithStatus(base, curr);
  const expected = {
    address: "removed",
    email: "added",
    city: undefined,
    age: "reordered",
    name: "reordered",
    id: "reordered",
  };

  expect(Object.keys(result)).toEqual(Object.keys(expected));
  expect(result).toEqual(expected);
});

test("should handle both arrays having the same keys", () => {
  const base = ["id", "name", "age"];
  const curr = ["id", "name", "age"];

  const result = mergeKeys(base, curr);

  // The expected result after merging is the same as the base array
  expect(result).toEqual(base);
});
