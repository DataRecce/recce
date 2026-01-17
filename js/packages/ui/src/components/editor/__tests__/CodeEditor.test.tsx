/**
 * @file CodeEditor.test.tsx
 * @description Tests for UI Package CodeEditor component
 *
 * Tests verify:
 * - Rendering of editor container
 * - Language support (SQL, YAML, text)
 * - Theme support (light and dark modes)
 * - Read-only mode
 * - Line numbers toggle
 * - Word wrap
 * - Font size customization
 * - onChange callback invocation
 * - Custom key bindings
 * - className prop (custom class + no-track-pii-safe)
 */

// ============================================================================
// Mock Setup - Use globalThis to avoid Jest hoisting issues
// ============================================================================

import { type Mock, vi } from "vitest";

// TypeScript declaration for global mock store
declare global {
  // eslint-disable-next-line no-var
  var __codeMirrorMockStore: {
    sql: Mock;
    yaml: Mock;
    lineWrapping: { type: string };
    editorViewTheme: Mock;
    keymapOf: Mock;
    precHighest: Mock;
    codeMirrorProps: Record<string, unknown> | null;
  };
}

// Mock CodeMirror dependencies - each mock factory initializes the global store
vi.mock("@codemirror/lang-sql", () => {
  // Initialize store if not exists
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const sqlFn = vi.fn(() => ({ type: "sql" }));
  globalThis.__codeMirrorMockStore.sql = sqlFn;

  return {
    sql: sqlFn,
    PostgreSQL: { name: "PostgreSQL" },
  };
});

vi.mock("@codemirror/lang-yaml", () => {
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const yamlFn = vi.fn(() => ({ type: "yaml" }));
  globalThis.__codeMirrorMockStore.yaml = yamlFn;

  return {
    yaml: yamlFn,
  };
});

vi.mock("@uiw/codemirror-theme-github", () => ({
  githubDark: { type: "githubDark" },
  githubLight: { type: "githubLight" },
}));

vi.mock("@codemirror/state", () => {
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const precHighestFn = vi.fn((ext: unknown) => ({
    type: "precHighest",
    ext,
  }));
  globalThis.__codeMirrorMockStore.precHighest = precHighestFn;

  return {
    Prec: {
      highest: precHighestFn,
    },
  };
});

vi.mock("@codemirror/view", () => {
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const lineWrapping = { type: "lineWrapping" };
  const themeFn = vi.fn(() => ({ type: "theme" }));
  const keymapOfFn = vi.fn((bindings: unknown) => ({
    type: "keymap",
    bindings,
  }));

  globalThis.__codeMirrorMockStore.lineWrapping = lineWrapping;
  globalThis.__codeMirrorMockStore.editorViewTheme = themeFn;
  globalThis.__codeMirrorMockStore.keymapOf = keymapOfFn;

  return {
    EditorView: {
      theme: themeFn,
      lineWrapping: lineWrapping,
    },
    keymap: {
      of: keymapOfFn,
    },
  };
});

// Mock @uiw/react-codemirror to capture props
vi.mock("@uiw/react-codemirror", () => {
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const React = require("react");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      globalThis.__codeMirrorMockStore.codeMirrorProps = props;
      return React.createElement("div", {
        "data-testid": "codemirror",
        className: props.className,
      });
    },
  };
});

// ============================================================================
// Imports (MUST come after vi.mock calls)
// ============================================================================

import { render, screen } from "@testing-library/react";
import { CodeEditor, type CodeEditorProps } from "../CodeEditor";

// ============================================================================
// Test Fixtures
// ============================================================================

// Local reference for cleaner test code
const mockStore = globalThis.__codeMirrorMockStore;

const createMockProps = (
  overrides: Partial<CodeEditorProps> = {},
): CodeEditorProps => ({
  value: "SELECT * FROM users;",
  ...overrides,
});

// ============================================================================
// Test Utilities
// ============================================================================

function resetMocks() {
  mockStore.sql.mockClear();
  mockStore.yaml.mockClear();
  mockStore.editorViewTheme.mockClear();
  mockStore.keymapOf.mockClear();
  mockStore.precHighest.mockClear();
  mockStore.codeMirrorProps = null;
}

// ============================================================================
// Tests
// ============================================================================

describe("CodeEditor", () => {
  beforeEach(() => {
    resetMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("creates editor container", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });

    it("passes value to CodeMirror", () => {
      render(<CodeEditor {...createMockProps({ value: "SELECT 1;" })} />);

      expect(mockStore.codeMirrorProps?.value).toBe("SELECT 1;");
    });

    it("passes height to CodeMirror", () => {
      render(<CodeEditor {...createMockProps({ height: "500px" })} />);

      expect(mockStore.codeMirrorProps?.height).toBe("500px");
    });

    it("uses default height of 100%", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.codeMirrorProps?.height).toBe("100%");
    });
  });

  // ==========================================================================
  // Language Support Tests
  // ==========================================================================

  describe("language support", () => {
    it("adds SQL language extension when language is sql", () => {
      render(<CodeEditor {...createMockProps({ language: "sql" })} />);

      expect(mockStore.sql).toHaveBeenCalledWith({
        dialect: { name: "PostgreSQL" },
      });
    });

    it("adds YAML language extension when language is yaml", () => {
      render(<CodeEditor {...createMockProps({ language: "yaml" })} />);

      expect(mockStore.yaml).toHaveBeenCalled();
    });

    it("adds no language extension for text mode", () => {
      render(<CodeEditor {...createMockProps({ language: "text" })} />);

      expect(mockStore.sql).not.toHaveBeenCalled();
      expect(mockStore.yaml).not.toHaveBeenCalled();
    });

    it("defaults to sql language when not specified", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.sql).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Theme Support Tests
  // ==========================================================================

  describe("theme support", () => {
    it("passes light theme by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.codeMirrorProps?.theme).toEqual({ type: "githubLight" });
    });

    it("passes dark theme when theme prop is dark", () => {
      render(<CodeEditor {...createMockProps({ theme: "dark" })} />);

      expect(mockStore.codeMirrorProps?.theme).toEqual({ type: "githubDark" });
    });

    it("passes light theme when theme prop is light", () => {
      render(<CodeEditor {...createMockProps({ theme: "light" })} />);

      expect(mockStore.codeMirrorProps?.theme).toEqual({ type: "githubLight" });
    });
  });

  // ==========================================================================
  // Read-Only Mode Tests
  // ==========================================================================

  describe("read-only mode", () => {
    it("passes readOnly true to CodeMirror", () => {
      render(<CodeEditor {...createMockProps({ readOnly: true })} />);

      expect(mockStore.codeMirrorProps?.readOnly).toBe(true);
    });

    it("passes readOnly false to CodeMirror", () => {
      render(<CodeEditor {...createMockProps({ readOnly: false })} />);

      expect(mockStore.codeMirrorProps?.readOnly).toBe(false);
    });

    it("defaults to editable (readOnly false)", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.codeMirrorProps?.readOnly).toBe(false);
    });
  });

  // ==========================================================================
  // Line Numbers Tests
  // ==========================================================================

  describe("line numbers", () => {
    it("shows line numbers by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.lineNumbers).toBe(true);
    });

    it("shows line numbers when lineNumbers is true", () => {
      render(<CodeEditor {...createMockProps({ lineNumbers: true })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.lineNumbers).toBe(true);
    });

    it("hides line numbers when lineNumbers is false", () => {
      render(<CodeEditor {...createMockProps({ lineNumbers: false })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.lineNumbers).toBe(false);
    });
  });

  // ==========================================================================
  // Word Wrap Tests
  // ==========================================================================

  describe("word wrap", () => {
    it("enables word wrap by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      const extensions = mockStore.codeMirrorProps?.extensions as unknown[];
      expect(extensions).toContainEqual(mockStore.lineWrapping);
    });

    it("enables word wrap when wordWrap is true", () => {
      render(<CodeEditor {...createMockProps({ wordWrap: true })} />);

      const extensions = mockStore.codeMirrorProps?.extensions as unknown[];
      expect(extensions).toContainEqual(mockStore.lineWrapping);
    });

    it("disables word wrap when wordWrap is false", () => {
      render(<CodeEditor {...createMockProps({ wordWrap: false })} />);

      const extensions = mockStore.codeMirrorProps?.extensions as unknown[];
      expect(extensions).not.toContainEqual(mockStore.lineWrapping);
    });
  });

  // ==========================================================================
  // Font Size Tests
  // ==========================================================================

  describe("font size", () => {
    it("uses default font size of 14px", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const calls = mockStore.editorViewTheme.mock.calls as unknown as Record<
        string,
        Record<string, string>
      >[][];
      const themeStyles = calls[0]?.[0];
      expect(themeStyles?.["&"]?.fontSize).toBe("14px");
    });

    it("uses custom font size when provided", () => {
      render(<CodeEditor {...createMockProps({ fontSize: 16 })} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const calls = mockStore.editorViewTheme.mock.calls as unknown as Record<
        string,
        Record<string, string>
      >[][];
      const themeStyles = calls[0]?.[0];
      expect(themeStyles?.["&"]?.fontSize).toBe("16px");
    });
  });

  // ==========================================================================
  // onChange Callback Tests
  // ==========================================================================

  describe("onChange callback", () => {
    it("passes onChange handler to CodeMirror", () => {
      const onChange = vi.fn();
      render(<CodeEditor {...createMockProps({ onChange })} />);

      expect(mockStore.codeMirrorProps?.onChange).toBeDefined();
    });

    it("calls provided onChange when CodeMirror onChange fires", () => {
      const onChange = vi.fn();
      render(<CodeEditor {...createMockProps({ onChange })} />);

      // Simulate CodeMirror calling our onChange handler
      const cmOnChange = mockStore.codeMirrorProps?.onChange as (
        val: string,
      ) => void;
      cmOnChange("new value");

      expect(onChange).toHaveBeenCalledWith("new value");
    });

    it("handles undefined onChange gracefully", () => {
      render(<CodeEditor {...createMockProps({ onChange: undefined })} />);

      // Should not throw when CodeMirror onChange fires without a handler
      const cmOnChange = mockStore.codeMirrorProps?.onChange as (
        val: string,
      ) => void;
      expect(() => cmOnChange("new value")).not.toThrow();
    });
  });

  // ==========================================================================
  // Custom Key Bindings Tests
  // ==========================================================================

  describe("custom key bindings", () => {
    it("adds key bindings with highest precedence when provided", () => {
      const keyBindings = [
        { key: "Mod-Enter", run: () => true },
        { key: "Mod-s", run: () => true },
      ];

      render(<CodeEditor {...createMockProps({ keyBindings })} />);

      expect(mockStore.keymapOf).toHaveBeenCalledWith(keyBindings);
      expect(mockStore.precHighest).toHaveBeenCalled();
    });

    it("does not add key bindings when empty array is provided", () => {
      render(<CodeEditor {...createMockProps({ keyBindings: [] })} />);

      expect(mockStore.keymapOf).not.toHaveBeenCalled();
      expect(mockStore.precHighest).not.toHaveBeenCalled();
    });

    it("does not add key bindings when not provided (default)", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.keymapOf).not.toHaveBeenCalled();
      expect(mockStore.precHighest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // className Prop Tests
  // ==========================================================================

  describe("className prop", () => {
    it("includes no-track-pii-safe class by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      const className = mockStore.codeMirrorProps?.className as string;
      expect(className).toContain("no-track-pii-safe");
    });

    it("includes custom className when provided", () => {
      render(
        <CodeEditor {...createMockProps({ className: "custom-editor" })} />,
      );

      const className = mockStore.codeMirrorProps?.className as string;
      expect(className).toContain("custom-editor");
      expect(className).toContain("no-track-pii-safe");
    });

    it("handles undefined className gracefully", () => {
      render(<CodeEditor {...createMockProps({ className: undefined })} />);

      const className = mockStore.codeMirrorProps?.className as string;
      expect(className).toContain("no-track-pii-safe");
    });
  });

  // ==========================================================================
  // Basic Setup Tests
  // ==========================================================================

  describe("basicSetup configuration", () => {
    it("enables foldGutter", () => {
      render(<CodeEditor {...createMockProps()} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.foldGutter).toBe(true);
    });

    it("sets tabSize to 2", () => {
      render(<CodeEditor {...createMockProps()} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.tabSize).toBe(2);
    });

    it("enables highlightActiveLineGutter when not readOnly", () => {
      render(<CodeEditor {...createMockProps({ readOnly: false })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.highlightActiveLineGutter).toBe(true);
    });

    it("disables highlightActiveLineGutter when readOnly", () => {
      render(<CodeEditor {...createMockProps({ readOnly: true })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.highlightActiveLineGutter).toBe(false);
    });

    it("enables highlightActiveLine when not readOnly", () => {
      render(<CodeEditor {...createMockProps({ readOnly: false })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.highlightActiveLine).toBe(true);
    });

    it("disables highlightActiveLine when readOnly", () => {
      render(<CodeEditor {...createMockProps({ readOnly: true })} />);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.highlightActiveLine).toBe(false);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders complete editor with all features", () => {
      const onChange = vi.fn();
      const keyBindings = [{ key: "Mod-Enter", run: () => true }];

      render(
        <CodeEditor
          value="SELECT * FROM users WHERE id = 1;"
          onChange={onChange}
          language="sql"
          readOnly={false}
          lineNumbers={true}
          wordWrap={true}
          fontSize={14}
          height="400px"
          className="sql-editor"
          theme="dark"
          keyBindings={keyBindings}
        />,
      );

      // Verify container renders
      expect(screen.getByTestId("codemirror")).toBeInTheDocument();

      // Verify all extensions are configured
      expect(mockStore.sql).toHaveBeenCalled();
      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      expect(mockStore.precHighest).toHaveBeenCalled();

      // Verify theme is dark
      expect(mockStore.codeMirrorProps?.theme).toEqual({ type: "githubDark" });

      // Verify value is passed
      expect(mockStore.codeMirrorProps?.value).toBe(
        "SELECT * FROM users WHERE id = 1;",
      );
    });

    it("renders read-only YAML editor", () => {
      render(
        <CodeEditor
          value="key: value\nlist:\n  - item1\n  - item2"
          language="yaml"
          readOnly={true}
          lineNumbers={true}
          theme="light"
          height="300px"
        />,
      );

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.yaml).toHaveBeenCalled();
      expect(mockStore.codeMirrorProps?.readOnly).toBe(true);

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.lineNumbers).toBe(true);
    });

    it("renders minimal text editor", () => {
      render(
        <CodeEditor
          value="Plain text content"
          language="text"
          lineNumbers={false}
          wordWrap={false}
        />,
      );

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.sql).not.toHaveBeenCalled();
      expect(mockStore.yaml).not.toHaveBeenCalled();

      const basicSetup = mockStore.codeMirrorProps?.basicSetup as Record<
        string,
        unknown
      >;
      expect(basicSetup?.lineNumbers).toBe(false);

      const extensions = mockStore.codeMirrorProps?.extensions as unknown[];
      expect(extensions).not.toContainEqual(mockStore.lineWrapping);
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty string value", () => {
      render(<CodeEditor {...createMockProps({ value: "" })} />);

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.codeMirrorProps?.value).toBe("");
    });

    it("handles very long content", () => {
      const longContent = "SELECT ".repeat(10000);
      render(<CodeEditor {...createMockProps({ value: longContent })} />);

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.codeMirrorProps?.value).toBe(longContent);
    });

    it("handles multiline content", () => {
      const multilineContent = `SELECT
  id,
  name,
  email
FROM users
WHERE active = true
ORDER BY created_at DESC;`;

      render(<CodeEditor {...createMockProps({ value: multilineContent })} />);

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.codeMirrorProps?.value).toBe(multilineContent);
    });

    it("handles special characters in content", () => {
      const specialContent =
        "SELECT * FROM users WHERE name = 'O\\'Brien' AND data->>'key' = 'value';";
      render(<CodeEditor {...createMockProps({ value: specialContent })} />);

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
      expect(mockStore.codeMirrorProps?.value).toBe(specialContent);
    });

    it("handles rapid value changes without throwing", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ value: "v1" })} />,
      );

      expect(() => {
        for (let i = 2; i <= 5; i++) {
          rerender(<CodeEditor {...createMockProps({ value: `v${i}` })} />);
        }
      }).not.toThrow();

      expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Prop Change Tests
  // ==========================================================================

  describe("prop changes", () => {
    it("updates when language changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ language: "sql" })} />,
      );

      mockStore.sql.mockClear();

      rerender(<CodeEditor {...createMockProps({ language: "yaml" })} />);

      expect(mockStore.yaml).toHaveBeenCalled();
    });

    it("updates when theme changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ theme: "light" })} />,
      );

      rerender(<CodeEditor {...createMockProps({ theme: "dark" })} />);

      expect(mockStore.codeMirrorProps?.theme).toEqual({ type: "githubDark" });
    });

    it("updates when fontSize changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ fontSize: 14 })} />,
      );

      mockStore.editorViewTheme.mockClear();

      rerender(<CodeEditor {...createMockProps({ fontSize: 16 })} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const calls = mockStore.editorViewTheme.mock.calls as unknown as Record<
        string,
        Record<string, string>
      >[][];
      const themeStyles = calls[0]?.[0];
      expect(themeStyles?.["&"]?.fontSize).toBe("16px");
    });
  });
});
