/**
 * Tests for tooltip message constants
 */
import {
  type DisableTooltipMessageKey,
  DisableTooltipMessages,
} from "../tooltipMessage";

describe("DisableTooltipMessages", () => {
  test("should export add_or_remove message", () => {
    expect(DisableTooltipMessages.add_or_remove).toBe(
      "Unavailable for added or removed resources.",
    );
  });

  test("should be immutable (const assertion)", () => {
    // TypeScript enforces this at compile time with 'as const'
    // At runtime, we verify the object structure
    expect(Object.keys(DisableTooltipMessages)).toEqual(["add_or_remove"]);
  });

  test("DisableTooltipMessageKey type should include add_or_remove", () => {
    // Type-level test: this compiles only if the type is correct
    const key: DisableTooltipMessageKey = "add_or_remove";
    expect(key).toBe("add_or_remove");
  });

  test("should allow indexing with valid keys", () => {
    const key: DisableTooltipMessageKey = "add_or_remove";
    const message = DisableTooltipMessages[key];
    expect(message).toBeDefined();
    expect(typeof message).toBe("string");
  });
});
