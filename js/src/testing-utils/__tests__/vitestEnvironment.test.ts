import { describe, expect, it } from "vitest";

describe("Vitest environment", () => {
  it("exposes standards-compatible localStorage on globalThis", () => {
    expect(globalThis.localStorage).toBeDefined();
    expect(globalThis.localStorage.getItem).toBeTypeOf("function");

    globalThis.localStorage.setItem("vitest-environment", "node-26");
    expect(window.localStorage.getItem("vitest-environment")).toBe("node-26");
    globalThis.localStorage.removeItem("vitest-environment");
  });
});
