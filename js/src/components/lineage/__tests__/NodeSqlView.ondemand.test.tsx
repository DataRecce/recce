/**
 * @file NodeSqlView.ondemand.test.tsx
 * @description Tests for the on-demand raw_code fetch in NodeSqlViewOss.
 *
 * Covers DRC-3263: when raw_code is stripped from the /info lineage payload,
 * NodeSqlViewOss fetches it via /api/model/{id} and merges it into the node
 * before delegating to the base NodeSqlView.
 *
 * Scenarios:
 * - Loading skeleton while fetch is in flight
 * - Rendered code after fetch succeeds (diff and single-env)
 * - "No code available" fallback when fetch returns empty
 * - null raw_code (JSON null from backend) triggers fetch
 * - Inline raw_code bypasses fetch entirely
 */

import { type Mock, vi } from "vitest";

// Mutable mock — each test writes the desired return value before render.
let mockUseQueryReturn: {
  data: unknown;
  isLoading: boolean;
  error?: unknown;
} = { data: undefined, isLoading: false };

vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useRecceServerFlag: vi.fn(() => ({
    data: { single_env_onboarding: false },
    isLoading: false,
  })),
}));

vi.mock("@datarecce/ui/hooks", () => ({
  useIsDark: vi.fn(() => false),
  useApiConfig: vi.fn(() => ({ apiClient: { get: vi.fn() } })),
}));

vi.mock("@datarecce/ui/primitives", () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <div data-testid="code-editor" data-value={value} />
  ),
  DiffEditor: ({
    original,
    modified,
  }: {
    original: string;
    modified: string;
  }) => (
    <div
      data-testid="diff-editor"
      data-original={original}
      data-modified={modified}
    />
  ),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => mockUseQueryReturn),
  };
});

// Imports after mocks
import type { LineageGraphNode } from "@datarecce/ui";
import { NodeSqlViewOss as NodeSqlView } from "@datarecce/ui/components/lineage";
import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

function createNode(overrides: {
  resourceType?: string;
  // undefined => field absent, null => JSON null, string => has code
  baseRawCode?: string | null;
  currentRawCode?: string | null;
} = {}): LineageGraphNode {
  const resourceType = overrides.resourceType ?? "model";
  const base =
    overrides.baseRawCode !== undefined
      ? {
          id: "model.test.my_model",
          unique_id: "model.test.my_model",
          name: "my_model",
          resource_type: resourceType,
          package_name: "test",
          raw_code: overrides.baseRawCode as string | undefined,
        }
      : undefined;
  const current =
    overrides.currentRawCode !== undefined
      ? {
          id: "model.test.my_model",
          unique_id: "model.test.my_model",
          name: "my_model",
          resource_type: resourceType,
          package_name: "test",
          raw_code: overrides.currentRawCode as string | undefined,
        }
      : undefined;

  return {
    id: "model.test.my_model",
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id: "model.test.my_model",
      name: "my_model",
      from: "both",
      data: { base, current },
      resourceType,
      packageName: "test",
      parents: {},
      children: {},
    },
  } as unknown as LineageGraphNode;
}

describe("NodeSqlViewOss on-demand raw_code fetch", () => {
  beforeEach(() => {
    mockUseQueryReturn = { data: undefined, isLoading: false };
    (useQuery as Mock).mockImplementation(() => mockUseQueryReturn);
  });

  it("shows loading skeleton while fetching raw_code", () => {
    mockUseQueryReturn = { data: undefined, isLoading: true };

    // No raw_code inline → triggers fetch → loading skeleton
    const node = createNode({});
    render(<NodeSqlView node={node} />);

    expect(screen.getByTestId("node-sql-view-loading")).toBeInTheDocument();
    expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
  });

  it("renders fetched raw_code in diff editor when both envs returned", () => {
    mockUseQueryReturn = {
      data: {
        model: {
          base: { raw_code: "SELECT * FROM base" },
          current: { raw_code: "SELECT * FROM current" },
        },
      },
      isLoading: false,
    };

    const node = createNode({});
    render(<NodeSqlView node={node} />);

    const editor = screen.getByTestId("diff-editor");
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("data-original", "SELECT * FROM base");
    expect(editor).toHaveAttribute("data-modified", "SELECT * FROM current");
  });

  it("falls back to 'No code available' when fetch returns empty", () => {
    mockUseQueryReturn = {
      data: { model: { base: {}, current: {} } },
      isLoading: false,
    };

    const node = createNode({});
    render(<NodeSqlView node={node} />);

    expect(screen.getByText("No code available")).toBeInTheDocument();
  });

  it("triggers fetch when inline raw_code is null (Pydantic JSON null)", () => {
    mockUseQueryReturn = {
      data: {
        model: {
          base: { raw_code: "SELECT base" },
          current: { raw_code: "SELECT current" },
        },
      },
      isLoading: false,
    };

    const node = createNode({ baseRawCode: null, currentRawCode: null });
    render(<NodeSqlView node={node} />);

    const editor = screen.getByTestId("diff-editor");
    expect(editor).toHaveAttribute("data-original", "SELECT base");
    expect(editor).toHaveAttribute("data-modified", "SELECT current");
  });

  it("uses inline raw_code and ignores fetched data when both present", () => {
    mockUseQueryReturn = {
      data: {
        model: {
          base: { raw_code: "FETCHED base" },
          current: { raw_code: "FETCHED current" },
        },
      },
      isLoading: false,
    };

    const node = createNode({
      baseRawCode: "INLINE base",
      currentRawCode: "INLINE current",
    });
    render(<NodeSqlView node={node} />);

    const editor = screen.getByTestId("diff-editor");
    expect(editor).toHaveAttribute("data-original", "INLINE base");
    expect(editor).toHaveAttribute("data-modified", "INLINE current");
  });
});
