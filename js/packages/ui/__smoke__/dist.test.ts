import { describe, expect, test } from "vitest";

import pkg from "../package.json" with { type: "json" };

type ExportTarget = string | Record<string, string>;

const resolveTarget = (target: ExportTarget): string =>
  typeof target === "string" ? target : (target.import ?? target.default);

const allEntries = Object.entries(pkg.exports as Record<string, ExportTarget>)
  .map(([subpath, target]) => [subpath, resolveTarget(target)] as const)
  .filter(([, file]) => Boolean(file));

const jsEntries = allEntries.filter(([, file]) => file.endsWith(".js"));

describe("built @datarecce/ui entries", () => {
  // An exports entry whose shape this test cannot classify would otherwise drop
  // out of the suite and still report green.
  test("every exports entry resolves to a file this suite classifies", () => {
    expect(allEntries.length).toBe(Object.keys(pkg.exports).length);
    const unclassified = allEntries.filter(
      ([, file]) => !file.endsWith(".js") && !file.endsWith(".css"),
    );
    expect(unclassified).toEqual([]);
    expect(jsEntries.length).toBeGreaterThan(0);
  });

  // A bundler that emits the wrong module initialization order fails this
  // import with a ReferenceError. A rolldown upgrade has caused that before.
  test.each(jsEntries)(
    "%s imports and exports bindings",
    async (_sub, file) => {
      const mod = await import(
        /* @vite-ignore */ `../${file.replace("./", "")}`
      );
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    },
  );
});
