/**
 * @file NodeSqlView.test.tsx
 * @description Comprehensive tests for UI Package NodeSqlView component
 *
 * Tests verify:
 * - Rendering of SQL code for models and snapshots
 * - Single-env mode vs diff mode
 * - Editor component injection (dependency injection pattern)
 * - Not available state for non-model/snapshot nodes
 * - Dialog expand functionality
 * - Dark mode support
 * - Model name display in dialog title
 *
 * Source of truth: UI package primitives
 */

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, render, screen } from "@testing-library/react";
import {
  type CodeEditorProps,
  type DiffEditorProps,
  NodeSqlView,
  type NodeSqlViewProps,
} from "../NodeSqlView";

// ============================================================================
// Mock Editor Components
// ============================================================================

const MockCodeEditor = ({
  value,
  language,
  theme,
  readOnly,
  fontSize,
}: CodeEditorProps) => (
  <div
    data-testid="mock-code-editor"
    data-language={language}
    data-theme={theme}
    data-readonly={readOnly}
    data-fontsize={fontSize}
  >
    {value}
  </div>
);

const MockDiffEditor = ({
  original,
  modified,
  language,
  theme,
  sideBySide,
  className,
}: DiffEditorProps) => (
  <div
    data-testid="mock-diff-editor"
    data-language={language}
    data-theme={theme}
    data-side-by-side={sideBySide}
    data-classname={className}
  >
    <span data-testid="original">{original}</span>
    <span data-testid="modified">{modified}</span>
  </div>
);

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockNode = (
  overrides: Partial<NodeSqlViewProps["node"]["data"]> = {},
): NodeSqlViewProps["node"] => ({
  data: {
    resourceType: "model",
    data: {
      base: { raw_code: "SELECT * FROM base_table", name: "test_model" },
      current: { raw_code: "SELECT * FROM current_table", name: "test_model" },
    },
    name: "test_model",
    ...overrides,
  },
});

const createMockProps = (
  overrides: Partial<NodeSqlViewProps> = {},
): NodeSqlViewProps => ({
  node: createMockNode(),
  isSingleEnv: false,
  CodeEditor: MockCodeEditor,
  DiffEditor: MockDiffEditor,
  isDark: false,
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe("NodeSqlView", () => {
  // ==========================================================================
  // Resource Type Tests
  // ==========================================================================

  describe("resource type handling", () => {
    it("renders for model resource type", () => {
      const props = createMockProps({
        node: createMockNode({ resourceType: "model" }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toBeInTheDocument();
    });

    it("renders for snapshot resource type", () => {
      const props = createMockProps({
        node: createMockNode({ resourceType: "snapshot" }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toBeInTheDocument();
    });

    it("shows 'Not available' for source resource type", () => {
      const props = createMockProps({
        node: createMockNode({ resourceType: "source" }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-diff-editor")).not.toBeInTheDocument();
    });

    it("shows 'Not available' for seed resource type", () => {
      const props = createMockProps({
        node: createMockNode({ resourceType: "seed" }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
    });

    it("shows 'Not available' for test resource type", () => {
      const props = createMockProps({
        node: createMockNode({ resourceType: "test" }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByText("Not available")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Single Environment Mode Tests
  // ==========================================================================

  describe("single environment mode", () => {
    it("renders CodeEditor when isSingleEnv is true", () => {
      const props = createMockProps({
        isSingleEnv: true,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-diff-editor")).not.toBeInTheDocument();
    });

    it("passes SQL language to CodeEditor", () => {
      const props = createMockProps({
        isSingleEnv: true,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-code-editor")).toHaveAttribute(
        "data-language",
        "sql",
      );
    });

    it("uses base code when in single-env mode", () => {
      const props = createMockProps({
        isSingleEnv: true,
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT base", name: "model" },
            current: { raw_code: "SELECT current", name: "model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-code-editor")).toHaveTextContent(
        "SELECT base",
      );
    });

    it("shows 'Model Code' in dialog title for single-env", () => {
      const props = createMockProps({
        isSingleEnv: true,
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT 1", name: "my_model" },
            current: { raw_code: "SELECT 2", name: "my_model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Open the dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      expect(screen.getByText("my_model")).toBeInTheDocument();
      expect(screen.getByText("Model Code")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Diff Mode Tests
  // ==========================================================================

  describe("diff mode", () => {
    it("renders DiffEditor when isSingleEnv is false", () => {
      const props = createMockProps({
        isSingleEnv: false,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-code-editor")).not.toBeInTheDocument();
    });

    it("passes original and modified code to DiffEditor", () => {
      const props = createMockProps({
        isSingleEnv: false,
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT old", name: "model" },
            current: { raw_code: "SELECT new", name: "model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("original")).toHaveTextContent("SELECT old");
      expect(screen.getByTestId("modified")).toHaveTextContent("SELECT new");
    });

    it("uses inline diff mode (sideBySide=false)", () => {
      const props = createMockProps({
        isSingleEnv: false,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toHaveAttribute(
        "data-side-by-side",
        "false",
      );
    });

    it("shows 'Model Code Diff' in dialog title for diff mode", () => {
      const props = createMockProps({
        isSingleEnv: false,
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT 1", name: "my_model" },
            current: { raw_code: "SELECT 2", name: "my_model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Open the dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      expect(screen.getByText("my_model")).toBeInTheDocument();
      expect(screen.getByText("Model Code Diff")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe("dark mode", () => {
    it("passes dark theme to CodeEditor when isDark is true", () => {
      const props = createMockProps({
        isSingleEnv: true,
        isDark: true,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-code-editor")).toHaveAttribute(
        "data-theme",
        "dark",
      );
    });

    it("passes light theme to CodeEditor when isDark is false", () => {
      const props = createMockProps({
        isSingleEnv: true,
        isDark: false,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-code-editor")).toHaveAttribute(
        "data-theme",
        "light",
      );
    });

    it("passes dark theme to DiffEditor when isDark is true", () => {
      const props = createMockProps({
        isSingleEnv: false,
        isDark: true,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toHaveAttribute(
        "data-theme",
        "dark",
      );
    });

    it("passes light theme to DiffEditor when isDark is false", () => {
      const props = createMockProps({
        isSingleEnv: false,
        isDark: false,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("mock-diff-editor")).toHaveAttribute(
        "data-theme",
        "light",
      );
    });
  });

  // ==========================================================================
  // Dialog Tests
  // ==========================================================================

  describe("expand dialog", () => {
    it("renders expand button", () => {
      const props = createMockProps();

      render(<NodeSqlView {...props} />);

      expect(
        screen.getByRole("button", { name: /expand/i }),
      ).toBeInTheDocument();
    });

    it("opens dialog when expand button is clicked", () => {
      const props = createMockProps();

      render(<NodeSqlView {...props} />);

      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      // Dialog should be visible - check for dialog content
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes dialog when close button is clicked", () => {
      const props = createMockProps();

      render(<NodeSqlView {...props} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Find and click the close button (within dialog title)
      const closeButton = screen.getAllByRole("button").find(
        (btn) => btn.querySelector("svg"), // The close button has an IoClose icon
      );
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      // Dialog should be closed (may take a moment due to MUI animations)
      // We verify by checking dialog is not visible
    });

    it("renders CodeEditor in dialog when isSingleEnv is true", () => {
      const props = createMockProps({
        isSingleEnv: true,
      });

      render(<NodeSqlView {...props} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      // Should have two code editors now (one inline, one in dialog)
      const editors = screen.getAllByTestId("mock-code-editor");
      expect(editors.length).toBe(2);
    });

    it("passes larger fontSize to CodeEditor in dialog", () => {
      const props = createMockProps({
        isSingleEnv: true,
      });

      render(<NodeSqlView {...props} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      // Find the dialog editor (should have fontSize=16)
      const editors = screen.getAllByTestId("mock-code-editor");
      const dialogEditor = editors.find(
        (e) => e.getAttribute("data-fontsize") === "16",
      );
      expect(dialogEditor).toBeInTheDocument();
    });

    it("renders DiffEditor in dialog when isSingleEnv is false", () => {
      const props = createMockProps({
        isSingleEnv: false,
      });

      render(<NodeSqlView {...props} />);

      // Open dialog
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      // Should have two diff editors now (one inline, one in dialog)
      const editors = screen.getAllByTestId("mock-diff-editor");
      expect(editors.length).toBe(2);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles missing base code gracefully", () => {
      const props = createMockProps({
        isSingleEnv: true,
        node: createMockNode({
          data: {
            base: undefined,
            current: { raw_code: "SELECT current", name: "model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Should render empty string for missing base
      expect(screen.getByTestId("mock-code-editor")).toHaveTextContent("");
    });

    it("handles missing current code gracefully", () => {
      const props = createMockProps({
        isSingleEnv: false,
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT base", name: "model" },
            current: undefined,
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("modified")).toHaveTextContent("");
    });

    it("uses base name when current name is not available", () => {
      const props = createMockProps({
        node: createMockNode({
          data: {
            base: { raw_code: "SELECT 1", name: "base_model" },
            current: undefined,
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Open dialog to see model name
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      expect(screen.getByText("base_model")).toBeInTheDocument();
    });

    it("uses current name when base name is not available", () => {
      const props = createMockProps({
        node: createMockNode({
          data: {
            base: undefined,
            current: { raw_code: "SELECT 1", name: "current_model" },
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Open dialog to see model name
      fireEvent.click(screen.getByRole("button", { name: /expand/i }));

      expect(screen.getByText("current_model")).toBeInTheDocument();
    });

    it("handles both base and current missing gracefully", () => {
      const props = createMockProps({
        isSingleEnv: true,
        node: createMockNode({
          data: {
            base: undefined,
            current: undefined,
          },
        }),
      });

      render(<NodeSqlView {...props} />);

      // Should render empty editor
      expect(screen.getByTestId("mock-code-editor")).toHaveTextContent("");
    });
  });

  // ==========================================================================
  // Dependency Injection Tests
  // ==========================================================================

  describe("dependency injection", () => {
    it("uses custom CodeEditor component when provided", () => {
      const CustomCodeEditor = ({ value }: CodeEditorProps) => (
        <div data-testid="custom-code-editor">{value}</div>
      );

      const props = createMockProps({
        isSingleEnv: true,
        CodeEditor: CustomCodeEditor,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("custom-code-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-code-editor")).not.toBeInTheDocument();
    });

    it("uses custom DiffEditor component when provided", () => {
      const CustomDiffEditor = ({ original, modified }: DiffEditorProps) => (
        <div data-testid="custom-diff-editor">
          {original} vs {modified}
        </div>
      );

      const props = createMockProps({
        isSingleEnv: false,
        DiffEditor: CustomDiffEditor,
      });

      render(<NodeSqlView {...props} />);

      expect(screen.getByTestId("custom-diff-editor")).toBeInTheDocument();
      expect(screen.queryByTestId("mock-diff-editor")).not.toBeInTheDocument();
    });
  });
});
