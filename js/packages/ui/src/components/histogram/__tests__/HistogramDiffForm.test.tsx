import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistogramDiffParams, NodeColumnData } from "../../../api";
import type { UseModelColumnsReturn } from "../../../hooks/useModelColumns";
import { HistogramDiffForm } from "../HistogramDiffForm";

const mockUseModelColumns =
  vi.fn<(model: string | undefined) => UseModelColumnsReturn>();

vi.mock("../../../hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks")>();
  return {
    ...actual,
    useModelColumns: (model: string | undefined) => mockUseModelColumns(model),
  };
});

const catalogColumns: NodeColumnData[] = [
  { name: "amount", type: "DECIMAL(12, 2)" },
  { name: "quantity", type: "INTEGER" },
  { name: "added_only", type: "BIGINT" },
  { name: "removed_only", type: "DOUBLE" },
  { name: "description", type: "VARCHAR" },
];

const columnAvailability = {
  amount: { base: true, current: true },
  quantity: { base: true, current: true },
  added_only: { base: false, current: true },
  removed_only: { base: true, current: false },
  description: { base: true, current: true },
};

function modelColumns(
  overrides: Partial<UseModelColumnsReturn> = {},
): UseModelColumnsReturn {
  return {
    columns: catalogColumns,
    columnAvailability,
    primaryKey: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  };
}

function ControlledForm({
  onSubmitRequested,
}: {
  onSubmitRequested: (params: HistogramDiffParams) => void;
}) {
  const [params, setParams] = useState<Partial<HistogramDiffParams>>({
    model: "orders",
    column_name: "",
    column_type: "",
  });

  return (
    <HistogramDiffForm
      params={params}
      onParamsChanged={setParams}
      setIsReadyToExecute={vi.fn()}
      onSubmitRequested={onSubmitRequested}
    />
  );
}

describe("HistogramDiffForm one-step selection", () => {
  beforeEach(() => {
    mockUseModelColumns.mockReset();
    mockUseModelColumns.mockReturnValue(modelColumns());
  });

  it.each([
    ["loading", modelColumns({ isLoading: true })],
    ["catalog error", modelColumns({ error: new Error("catalog failed") })],
    [
      "no eligible columns",
      modelColumns({ columns: [{ name: "description", type: "VARCHAR" }] }),
    ],
  ])("does not request submission while %s", (_state, columnsState) => {
    const onSubmitRequested = vi.fn();
    mockUseModelColumns.mockReturnValue(columnsState);

    render(<ControlledForm onSubmitRequested={onSubmitRequested} />);

    expect(onSubmitRequested).not.toHaveBeenCalled();
  });

  it("requests complete parameters once per explicit eligible selection", () => {
    const onSubmitRequested = vi.fn();
    const { rerender } = render(
      <ControlledForm onSubmitRequested={onSubmitRequested} />,
    );
    const picker = screen.getByRole("combobox");

    fireEvent.change(picker, { target: { value: "amount" } });

    expect(onSubmitRequested).toHaveBeenCalledTimes(1);
    expect(onSubmitRequested).toHaveBeenLastCalledWith({
      model: "orders",
      column_name: "amount",
      column_type: "DECIMAL(12, 2)",
    });

    rerender(<ControlledForm onSubmitRequested={onSubmitRequested} />);
    expect(onSubmitRequested).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "quantity" },
    });

    expect(onSubmitRequested).toHaveBeenCalledTimes(2);
    expect(onSubmitRequested).toHaveBeenLastCalledWith({
      model: "orders",
      column_name: "quantity",
      column_type: "INTEGER",
    });
  });

  it.each(["added_only", "removed_only"])(
    "keeps %s visible but ineligible for submission",
    (columnName) => {
      const onSubmitRequested = vi.fn();
      const setIsReadyToExecute = vi.fn();

      render(
        <HistogramDiffForm
          params={{ model: "orders", column_name: "", column_type: "" }}
          onParamsChanged={vi.fn()}
          setIsReadyToExecute={setIsReadyToExecute}
          onSubmitRequested={onSubmitRequested}
        />,
      );

      expect(
        screen.getByRole("option", { name: new RegExp(columnName) }),
      ).toBeDisabled();

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: columnName },
      });

      expect(setIsReadyToExecute).toHaveBeenLastCalledWith(false);
      expect(onSubmitRequested).not.toHaveBeenCalled();
    },
  );
});
