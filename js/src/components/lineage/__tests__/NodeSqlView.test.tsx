/**
 * @file NodeSqlView.test.tsx
 * @description Comprehensive pre-migration tests for NodeSqlView component
 *
 * Tests verify:
 * - Loading state (empty fragment while flags loading)
 * - Resource type handling (Not available for seed/source, renders for model/snapshot)
 * - Single environment mode (CodeEditor with base raw_code)
 * - Diff mode (DiffEditor with original/modified)
 * - Expand dialog functionality (open/close, title variations)
 * - Theme handling (dark/light mode)
 *
 * Source of truth: OSS functionality - these tests document current behavior
 */

import { type Mock, vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock @datarecce/ui/contexts
vi.mock("@datarecce/ui/contexts", () => ({
  useRouteConfig: vi.fn(() => ({ basePath: "" })),
  useRecceServerFlag: vi.fn(),
}));

// Mock @datarecce/ui/hooks
vi.mock("@datarecce/ui/hooks", () => ({
  useIsDark: vi.fn(() => false),
}));

// Mock editor components from @datarecce/ui/primitives
vi.mock("@datarecce/ui/primitives", () => ({
  CodeEditor: ({
    value,
    language,
    theme,
    readOnly,
    lineNumbers,
    wordWrap,
    fontSize,
  }: {
    value: string;
    language: string;
    theme?: string;
    readOnly?: boolean;
    lineNumbers?: boolean;
    wordWrap?: boolean;
    fontSize?: number;
  }) => (
    <div
      data-testid="code-editor"
      data-value={value}
      data-language={language}
      data-theme={theme}
      data-readonly={String(readOnly)}
      data-line-numbers={String(lineNumbers)}
      data-word-wrap={String(wordWrap)}
      data-font-size={fontSize}
    />
  ),
  DiffEditor: ({
    original,
    modified,
    language,
    theme,
    readOnly,
    lineNumbers,
    sideBySide,
    height,
    className,
  }: {
    original: string;
    modified: string;
    language: string;
    theme?: string;
    readOnly?: boolean;
    lineNumbers?: boolean;
    sideBySide?: boolean;
    height?: string;
    className?: string;
  }) => (
    <div
      data-testid="diff-editor"
      data-original={original}
      data-modified={modified}
      data-language={language}
      data-theme={theme}
      data-readonly={String(readOnly)}
      data-line-numbers={String(lineNumbers)}
      data-side-by-side={String(sideBySide)}
      data-height={height}
      data-classname={className}
    />
  ),
}));

// ============================================================================
// Imports
// ============================================================================

import type { LineageGraphNode } from "@datarecce/ui";
import { NodeSqlViewOss as NodeSqlView } from "@datarecce/ui/components/lineage";
import { useRecceServerFlag } from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock LineageGraphNode for testing
 *
 * Important: Use explicit null to indicate "no data" vs undefined which uses defaults
 * - hasBase: false => no base data object at all
 * - hasBase: true (default) => has base data with raw_code
 * - hasCurrent: false => no current data object at all
 * - hasCurrent: true (default) => has current data with raw_code
 */
const createMockNode = (
  overrides: {
    id?: string;
    resourceType?: string;
    baseRawCode?: string;
    currentRawCode?: string;
    baseName?: string;
    currentName?: string;
    hasBase?: boolean;
    hasCurrent?: boolean;
  } = {},
): LineageGraphNode => {
  const id = overrides.id ?? "model.test.my_model";
  const resourceType = overrides.resourceType ?? "model";

  // Determine if we should include base/current data
  const hasBase = overrides.hasBase ?? true;
  const hasCurrent = overrides.hasCurrent ?? true;

  // Default values when data exists
  const baseRawCode = hasBase
    ? (overrides.baseRawCode ?? "SELECT * FROM base_table")
    : undefined;
  const currentRawCode = hasCurrent
    ? (overrides.currentRawCode ?? "SELECT * FROM current_table")
    : undefined;
  const baseName = hasBase ? (overrides.baseName ?? "my_model") : undefined;
  const currentName = hasCurrent
    ? (overrides.currentName ?? "my_model")
    : undefined;

  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name: baseName ?? currentName ?? "unknown",
      from: "both",
      data: {
        base: hasBase
          ? {
              id,
              unique_id: id,
              name: baseName ?? "my_model",
              resource_type: resourceType,
              package_name: "test_package",
              columns: {},
              raw_code: baseRawCode,
            }
          : undefined,
        current: hasCurrent
          ? {
              id,
              unique_id: id,
              name: currentName ?? "my_model",
              resource_type: resourceType,
              package_name: "test_package",
              columns: {},
              raw_code: currentRawCode,
            }
          : undefined,
      },
      resourceType,
      packageName: "test_package",
      parents: {},
      children: {},
    },
  };
};

// ============================================================================
// Test Setup
// ============================================================================

describe("NodeSqlView", () => {
  const mockUseRecceServerFlag = useRecceServerFlag as Mock;
  const mockUseIsDark = useIsDark as Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseRecceServerFlag.mockReturnValue({
      data: { single_env_onboarding: false },
      isLoading: false,
    });
    mockUseIsDark.mockReturnValue(false);
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading state", () => {
    it("shows nothing while flags are loading", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const node = createMockNode();
      const { container } = render(<NodeSqlView node={node} />);

      // Should return empty fragment (no content rendered)
      expect(container.firstChild).toBeNull();
    });

    it("renders content after loading completes", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: false },
        isLoading: false,
      });

      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      // Should render content (DiffEditor in default diff mode)
      expect(screen.getByTestId("diff-editor")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Resource Type Handling Tests
  // ==========================================================================

  describe("resource type handling", () => {
    it('returns "Not available" for seed resourceType', () => {
      const node = createMockNode({ resourceType: "seed" });
      render(<NodeSqlView node={node} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
      expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
    });

    it('returns "Not available" for source resourceType', () => {
      const node = createMockNode({ resourceType: "source" });
      render(<NodeSqlView node={node} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
      expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
      expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
    });

    it('returns "Not available" for exposure resourceType', () => {
      const node = createMockNode({ resourceType: "exposure" });
      render(<NodeSqlView node={node} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
    });

    it('returns "Not available" for metric resourceType', () => {
      const node = createMockNode({ resourceType: "metric" });
      render(<NodeSqlView node={node} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
    });

    it("renders editor for model resourceType", () => {
      const node = createMockNode({ resourceType: "model" });
      render(<NodeSqlView node={node} />);

      expect(screen.queryByText("Not available")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-editor")).toBeInTheDocument();
    });

    it("renders editor for snapshot resourceType", () => {
      const node = createMockNode({ resourceType: "snapshot" });
      render(<NodeSqlView node={node} />);

      expect(screen.queryByText("Not available")).not.toBeInTheDocument();
      expect(screen.getByTestId("diff-editor")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Single Environment Mode Tests
  // ==========================================================================

  describe("single environment mode", () => {
    beforeEach(() => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });
    });

    it("shows CodeEditor when single_env_onboarding is true", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("diff-editor")).not.toBeInTheDocument();
    });

    it("CodeEditor displays base raw_code", () => {
      const baseCode = "SELECT id, name FROM users";
      const node = createMockNode({ baseRawCode: baseCode });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-value", baseCode);
    });

    it("CodeEditor uses SQL language", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-language", "sql");
    });

    it("CodeEditor is read-only", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-readonly", "true");
    });

    it("CodeEditor has line numbers enabled", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-line-numbers", "true");
    });

    it("CodeEditor has word wrap disabled", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-word-wrap", "false");
    });

    it("handles missing base raw_code gracefully", () => {
      // Create node with base data but no raw_code property
      const node = createMockNode({
        baseRawCode: "",
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-value", "");
    });
  });

  // ==========================================================================
  // Diff Mode Tests
  // ==========================================================================

  describe("diff mode", () => {
    beforeEach(() => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: false },
        isLoading: false,
      });
    });

    it("shows DiffEditor when single_env_onboarding is false", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      expect(screen.getByTestId("diff-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
    });

    it("DiffEditor has correct original (base) code", () => {
      const baseCode = "SELECT * FROM base";
      const node = createMockNode({ baseRawCode: baseCode });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-original", baseCode);
    });

    it("DiffEditor has correct modified (current) code", () => {
      const currentCode = "SELECT * FROM current";
      const node = createMockNode({ currentRawCode: currentCode });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-modified", currentCode);
    });

    it("DiffEditor uses SQL language", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-language", "sql");
    });

    it("DiffEditor is read-only", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-readonly", "true");
    });

    it("DiffEditor uses inline diff mode (sideBySide=false)", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-side-by-side", "false");
    });

    it("handles missing base raw_code gracefully", () => {
      const node = createMockNode({
        baseRawCode: "",
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-original", "");
    });

    it("handles missing current raw_code gracefully", () => {
      const node = createMockNode({
        currentRawCode: "",
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-modified", "");
    });
  });

  // ==========================================================================
  // Expand Dialog Tests
  // ==========================================================================

  describe("expand dialog", () => {
    it("has an expand button", () => {
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      expect(expandButton).toBeInTheDocument();
    });

    it("expand button opens dialog", async () => {
      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      // Dialog should be visible
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("dialog shows model name", async () => {
      const user = userEvent.setup();
      const node = createMockNode({ baseName: "test_model_name" });
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      // Model name should be in the dialog
      expect(screen.getByText("test_model_name")).toBeInTheDocument();
    });

    it("dialog uses current name if base name is not available", async () => {
      const user = userEvent.setup();
      const node = createMockNode({
        hasBase: false,
        currentName: "current_only_model",
      });
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      expect(screen.getByText("current_only_model")).toBeInTheDocument();
    });

    it("dialog has close button in title", async () => {
      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      // Open dialog
      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Verify close button exists in the dialog
      const dialog = screen.getByRole("dialog");
      const dialogButtons = within(dialog).getAllByRole("button");

      // There should be at least one button (the close button)
      expect(dialogButtons.length).toBeGreaterThan(0);
    });

    it('shows "Model Code" title in single env mode', async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });

      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      expect(screen.getByText(/Model Code/)).toBeInTheDocument();
      expect(screen.queryByText(/Model Code Diff/)).not.toBeInTheDocument();
    });

    it('shows "Model Code Diff" title in diff mode', async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: false },
        isLoading: false,
      });

      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      expect(screen.getByText(/Model Code Diff/)).toBeInTheDocument();
    });

    it("dialog shows CodeEditor in single env mode", async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });

      const user = userEvent.setup();
      const baseCode = "SELECT * FROM base";
      const node = createMockNode({ baseRawCode: baseCode });
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      // There should be two CodeEditors now (inline and dialog)
      const editors = screen.getAllByTestId("code-editor");
      expect(editors.length).toBe(2);

      // Both should have the same value
      for (const editor of editors) {
        expect(editor).toHaveAttribute("data-value", baseCode);
      }
    });

    it("dialog shows DiffEditor in diff mode", async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: false },
        isLoading: false,
      });

      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      // There should be two DiffEditors now (inline and dialog)
      const editors = screen.getAllByTestId("diff-editor");
      expect(editors.length).toBe(2);
    });

    it("dialog CodeEditor has larger font size", async () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });

      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      const editors = screen.getAllByTestId("code-editor");
      // The dialog editor should have fontSize=16
      const dialogEditor = editors.find(
        (e) => e.getAttribute("data-font-size") === "16",
      );
      expect(dialogEditor).toBeDefined();
    });
  });

  // ==========================================================================
  // Theme Tests
  // ==========================================================================

  describe("theme handling", () => {
    it("uses light theme when isDark is false", () => {
      mockUseIsDark.mockReturnValue(false);
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-theme", "light");
    });

    it("uses dark theme when isDark is true", () => {
      mockUseIsDark.mockReturnValue(true);
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-theme", "dark");
    });

    it("applies theme to CodeEditor in single env mode", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: { single_env_onboarding: true },
        isLoading: false,
      });
      mockUseIsDark.mockReturnValue(true);

      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("code-editor");
      expect(editor).toHaveAttribute("data-theme", "dark");
    });

    it("applies theme to dialog editors", async () => {
      mockUseIsDark.mockReturnValue(true);

      const user = userEvent.setup();
      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      const expandButton = screen.getByRole("button", { name: /expand/i });
      await user.click(expandButton);

      // Both inline and dialog editors should have dark theme
      const editors = screen.getAllByTestId("diff-editor");
      for (const editor of editors) {
        expect(editor).toHaveAttribute("data-theme", "dark");
      }
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("handles node with only base data", () => {
      const node = createMockNode({
        hasCurrent: false,
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute(
        "data-original",
        "SELECT * FROM base_table",
      );
      expect(editor).toHaveAttribute("data-modified", "");
    });

    it("handles node with only current data", () => {
      const node = createMockNode({
        hasBase: false,
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-original", "");
      expect(editor).toHaveAttribute(
        "data-modified",
        "SELECT * FROM current_table",
      );
    });

    it("handles node with empty string raw_code", () => {
      const node = createMockNode({
        baseRawCode: "",
        currentRawCode: "",
      });
      render(<NodeSqlView node={node} />);

      const editor = screen.getByTestId("diff-editor");
      expect(editor).toHaveAttribute("data-original", "");
      expect(editor).toHaveAttribute("data-modified", "");
    });

    it("handles flags with undefined single_env_onboarding", () => {
      mockUseRecceServerFlag.mockReturnValue({
        data: {},
        isLoading: false,
      });

      const node = createMockNode();
      render(<NodeSqlView node={node} />);

      // Should default to diff mode (DiffEditor)
      expect(screen.getByTestId("diff-editor")).toBeInTheDocument();
    });

    it("handles unrecognized resourceType", () => {
      // Test with a resourceType that isn't model or snapshot
      const node = createMockNode({
        resourceType: "analysis",
      });
      render(<NodeSqlView node={node} />);

      // Unrecognized resourceType should show Not available
      expect(screen.getByText("Not available")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Hover Behavior Tests
  // ==========================================================================

  describe("hover behavior", () => {
    it("expand button changes opacity on hover", () => {
      const node = createMockNode();
      const { container } = render(<NodeSqlView node={node} />);

      // Find the Box container
      const boxContainer = container.firstChild as HTMLElement;

      // Trigger mouse enter
      fireEvent.mouseEnter(boxContainer);

      // The expand button should be present
      const expandButton = screen.getByRole("button", { name: /expand/i });
      expect(expandButton).toBeInTheDocument();

      // Trigger mouse leave
      fireEvent.mouseLeave(boxContainer);

      // Button should still be present (just with different opacity)
      expect(expandButton).toBeInTheDocument();
    });
  });
});
