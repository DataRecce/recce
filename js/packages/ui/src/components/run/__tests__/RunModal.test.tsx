import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistogramDiffParams } from "../../../api";
import type { UseModelColumnsReturn } from "../../../hooks/useModelColumns";
import { HistogramDiffForm } from "../../histogram/HistogramDiffForm";
import { RunModal } from "../RunModal";

const mockUseModelColumns =
  vi.fn<(model: string | undefined) => UseModelColumnsReturn>();

vi.mock("../../../hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks")>();
  return {
    ...actual,
    useModelColumns: (model: string | undefined) => mockUseModelColumns(model),
  };
});

describe("RunModal selection submission boundary", () => {
  beforeEach(() => {
    mockUseModelColumns.mockReset();
    mockUseModelColumns.mockReturnValue({
      columns: [
        { name: "amount", type: "DECIMAL(12, 2)" },
        { name: "quantity", type: "INTEGER" },
        { name: "added_only", type: "BIGINT" },
      ],
      columnAvailability: {
        amount: { base: true, current: true },
        quantity: { base: true, current: true },
        added_only: { base: false, current: true },
      },
      primaryKey: undefined,
      isLoading: false,
      error: null,
    });
  });

  it("executes exactly once from one explicit selection when opted in", () => {
    const onExecute = vi.fn();
    render(
      <RunModal<HistogramDiffParams>
        isOpen
        onClose={vi.fn()}
        onExecute={onExecute}
        title="Histogram Diff"
        type="histogram_diff"
        params={{ model: "orders", column_name: "", column_type: "" }}
        RunForm={HistogramDiffForm}
        submitOnSelection
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "amount" },
    });

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith("histogram_diff", {
      model: "orders",
      column_name: "amount",
      column_type: "DECIMAL(12, 2)",
    });
  });

  it("keeps Execute-button behavior when selection submission is not opted in", () => {
    const onExecute = vi.fn();
    render(
      <RunModal<HistogramDiffParams>
        isOpen
        onClose={vi.fn()}
        onExecute={onExecute}
        title="Histogram Diff"
        type="histogram_diff"
        params={{ model: "orders", column_name: "", column_type: "" }}
        RunForm={HistogramDiffForm}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "amount" },
    });
    expect(onExecute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Execute" }));
    expect(onExecute).toHaveBeenCalledTimes(1);
  });

  it("does not execute a one-sided catalog column", () => {
    const onExecute = vi.fn();
    render(
      <RunModal<HistogramDiffParams>
        isOpen
        onClose={vi.fn()}
        onExecute={onExecute}
        title="Histogram Diff"
        type="histogram_diff"
        params={{ model: "orders", column_name: "", column_type: "" }}
        RunForm={HistogramDiffForm}
        submitOnSelection
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "added_only" },
    });

    expect(onExecute).not.toHaveBeenCalled();
  });
});
