/**
 * @file ColumnLevelLineageControl.test.tsx
 *
 * Tests for newCllExperience visibility logic:
 * - hideImpactButton: hides button when newCllExperience + changeAnalysisMode
 * - showModeMessage: suppresses mode message for global impact (Layer 2),
 *   shows it for column-specific CLL (Layer 3)
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import type { LineageGraph } from "../../../../contexts/lineage/types";
import { ColumnLevelLineageControl } from "../ColumnLevelLineageControl";
import type { ColumnLevelLineageControlProps } from "../ColumnLevelLineageControl";

function createMinimalProps(
  overrides: Partial<ColumnLevelLineageControlProps> = {},
): ColumnLevelLineageControlProps {
  return {
    action: {
      isPending: false,
      isError: false,
      error: null,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    } as unknown as ColumnLevelLineageControlProps["action"],
    interactive: true,
    viewOptions: {},
    lineageGraph: {
      nodes: {},
      edges: {},
      modifiedSet: [],
      manifestMetadata: { base: undefined, current: undefined },
      catalogMetadata: { base: undefined, current: { generated_at: "" } },
    } as unknown as LineageGraph,
    singleEnvMode: false,
    changeAnalysisAvailable: true,
    onShowCll: vi.fn(),
    onResetCll: vi.fn(),
    onCenterNode: vi.fn(),
    ...overrides,
  };
}

describe("ColumnLevelLineageControl — newCllExperience", () => {
  it("shows Impact Radius button by default", () => {
    render(<ColumnLevelLineageControl {...createMinimalProps()} />);
    expect(
      screen.getByRole("button", { name: /impact radius/i }),
    ).toBeInTheDocument();
  });

  it("hides Impact Radius button when newCllExperience + changeAnalysisMode", () => {
    render(
      <ColumnLevelLineageControl
        {...createMinimalProps({
          newCllExperience: true,
          changeAnalysisMode: true,
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /impact radius/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Impact Radius button in newCllExperience before activation", () => {
    render(
      <ColumnLevelLineageControl
        {...createMinimalProps({
          newCllExperience: true,
          changeAnalysisMode: false,
        })}
      />,
    );
    expect(
      screen.getByRole("button", { name: /impact radius/i }),
    ).toBeInTheDocument();
  });

  it("suppresses mode message for global impact (Layer 2)", () => {
    render(
      <ColumnLevelLineageControl
        {...createMinimalProps({
          newCllExperience: true,
          changeAnalysisMode: true,
          viewOptions: {
            column_level_lineage: {
              change_analysis: true,
              no_upstream: true,
            },
          },
        })}
      />,
    );
    expect(screen.queryByText(/impact radius/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /reset/i }),
    ).not.toBeInTheDocument();
  });

  it("shows mode message for column-specific CLL (Layer 3)", () => {
    render(
      <ColumnLevelLineageControl
        {...createMinimalProps({
          newCllExperience: true,
          changeAnalysisMode: true,
          viewOptions: {
            column_level_lineage: {
              node_id: "model.test.orders",
              column: "order_id",
              change_analysis: true,
            },
          },
          lineageGraph: {
            nodes: {
              "model.test.orders": {
                id: "model.test.orders",
                data: { name: "orders" },
              },
            },
            edges: {},
            modifiedSet: [],
            manifestMetadata: { base: undefined, current: undefined },
            catalogMetadata: {
              base: undefined,
              current: { generated_at: "" },
            },
          } as unknown as LineageGraph,
        })}
      />,
    );
    expect(screen.getByText(/column lineage for/i)).toBeInTheDocument();
  });

  it("shows mode message for global impact without newCllExperience", () => {
    render(
      <ColumnLevelLineageControl
        {...createMinimalProps({
          newCllExperience: false,
          viewOptions: {
            column_level_lineage: {
              change_analysis: true,
              no_upstream: true,
            },
          },
        })}
      />,
    );
    expect(
      screen.getByText(/impact radius for all changed models/i),
    ).toBeInTheDocument();
  });
});
