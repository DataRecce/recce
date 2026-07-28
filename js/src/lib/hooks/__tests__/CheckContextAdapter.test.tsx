/**
 * @file CheckContextAdapter.test.tsx
 * @description Tests for CheckContextAdapter — the bridge between OSS and
 * @datarecce/ui's props-driven CheckProvider.
 *
 * The adapter owns the check-selection state and hands it to the provider under
 * both the canonical names (`selectedCheckId` / `onSelectCheck`) and the OSS
 * aliases (`latestSelectedCheckId` / `setLatestSelectedCheckId`), so shared
 * components and OSS components agree on which check is selected.
 *
 * The provider's own props-in/values-out behavior is covered by
 * packages/ui/src/providers/contexts/__tests__/CheckContext.test.tsx; what is
 * unique here is that both names address the same state, plus the fallback
 * `useRecceCheckContext` returns with no adapter mounted.
 */

import { CheckContextAdapter, useRecceCheckContext } from "@datarecce/ui/hooks";
import { useCheckContext } from "@datarecce/ui/providers";
import { act, render, renderHook, screen } from "@testing-library/react";

describe("CheckContextAdapter", () => {
  it("selects via either name and reflects the selection under both", () => {
    // Selection travels in both directions: the checklist writes through the
    // OSS alias, shared components write through `onSelectCheck`, and either
    // write has to be visible to the other.
    function CanonicalConsumer() {
      const { selectedCheckId, onSelectCheck } = useCheckContext();
      return (
        <div>
          <span data-testid="canonical">{selectedCheckId || "none"}</span>
          <button
            type="button"
            data-testid="select-canonical"
            onClick={() => onSelectCheck?.("check-canonical")}
          >
            Select via canonical
          </button>
        </div>
      );
    }

    function OssConsumer() {
      const { latestSelectedCheckId, setLatestSelectedCheckId } =
        useRecceCheckContext();
      return (
        <div>
          <span data-testid="oss">{latestSelectedCheckId || "none"}</span>
          <button
            type="button"
            data-testid="select-oss"
            onClick={() => setLatestSelectedCheckId("check-oss")}
          >
            Select via OSS alias
          </button>
        </div>
      );
    }

    render(
      <CheckContextAdapter>
        <CanonicalConsumer />
        <OssConsumer />
      </CheckContextAdapter>,
    );

    // Nothing is selected until the user picks a check.
    expect(screen.getByTestId("canonical")).toHaveTextContent("none");
    expect(screen.getByTestId("oss")).toHaveTextContent("none");

    act(() => {
      screen.getByTestId("select-oss").click();
    });

    expect(screen.getByTestId("canonical")).toHaveTextContent("check-oss");
    expect(screen.getByTestId("oss")).toHaveTextContent("check-oss");

    act(() => {
      screen.getByTestId("select-canonical").click();
    });

    expect(screen.getByTestId("canonical")).toHaveTextContent(
      "check-canonical",
    );
    expect(screen.getByTestId("oss")).toHaveTextContent("check-canonical");
  });

  it("falls back to an empty selection with no adapter mounted", () => {
    // OSS callers type both fields as required and call the setter without
    // optional chaining, so the hook substitutes an empty id and a no-op
    // setter outside the provider rather than handing back undefined.
    const { result } = renderHook(() => useRecceCheckContext());

    expect(result.current.latestSelectedCheckId).toBe("");
    expect(() => {
      result.current.setLatestSelectedCheckId("check-1");
    }).not.toThrow();
  });
});
