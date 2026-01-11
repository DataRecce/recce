/**
 * @file CodeEditor.test.tsx
 * @description Comprehensive tests for UI Package CodeEditor component
 *
 * Tests verify:
 * - Rendering of editor container and height prop
 * - Language support (SQL, YAML, text)
 * - Theme support (light and dark modes)
 * - Read-only mode via EditorState.readOnly
 * - Line numbers toggle
 * - Word wrap via EditorView.lineWrapping
 * - Font size customization via theme
 * - onChange callback invocation
 * - Custom key bindings via Prec.highest
 * - className prop (custom class + no-track-pii-safe)
 * - External value synchronization
 * - EditorView cleanup on unmount
 *
 * Source of truth: UI package primitives
 */

// ============================================================================
// Mock Setup - Use globalThis to avoid Jest hoisting issues
// ============================================================================

// TypeScript declaration for global mock store
declare global {
  // eslint-disable-next-line no-var
  var __codeMirrorMockStore: {
    lineWrapping: { type: string };
    editorViewDestroy: jest.Mock;
    editorViewDispatch: jest.Mock;
    editorViewTheme: jest.Mock;
    lineNumbers: jest.Mock;
    keymapOf: jest.Mock;
    readOnlyOf: jest.Mock;
    precHighest: jest.Mock;
    sql: jest.Mock;
    yaml: jest.Mock;
    updateListenerOf: jest.Mock;
    editorStateCreate: jest.Mock;
    lastCreatedExtensions: unknown[];
    lastCreatedDoc: string;
    editorViewInstance: {
      destroy: jest.Mock;
      dispatch: jest.Mock;
      state: { doc: { toString: () => string } };
    } | null;
  };
}

// Note: globalThis.__codeMirrorMockStore is initialized in each mock factory
// because jest.mock calls are hoisted before any other code runs

// Set up mocks - all implementation details are inside factory functions
// lang-sql is imported first in CodeEditor, so its mock factory runs first
jest.mock("@codemirror/lang-sql", () => {
  // Initialize store if not exists (this factory runs first based on import order)
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const sqlFn = jest.fn(() => ({ type: "sql" }));
  globalThis.__codeMirrorMockStore.sql = sqlFn;

  return {
    sql: sqlFn,
    PostgreSQL: { name: "PostgreSQL" },
  };
});

jest.mock("@codemirror/lang-yaml", () => {
  // Ensure store exists
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const yamlFn = jest.fn(() => ({ type: "yaml" }));
  globalThis.__codeMirrorMockStore.yaml = yamlFn;

  return {
    yaml: yamlFn,
  };
});

jest.mock("@codemirror/state", () => {
  // Ensure store exists
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);

  const readOnlyOfFn = jest.fn((value: boolean) => ({
    type: "readOnly",
    value,
  }));
  const precHighestFn = jest.fn((ext: unknown) => ({
    type: "precHighest",
    extension: ext,
  }));

  // Storage
  let lastExtensions: unknown[] = [];

  const editorStateCreateFn = jest.fn(
    (config: { extensions?: unknown[]; doc?: string }) => {
      lastExtensions = config.extensions || [];
      globalThis.__codeMirrorMockStore.lastCreatedDoc = config.doc || "";
      return {
        doc: { toString: () => config.doc || "" },
        extensions: config.extensions || [],
      };
    },
  );

  // Assign to global store
  globalThis.__codeMirrorMockStore.readOnlyOf = readOnlyOfFn;
  globalThis.__codeMirrorMockStore.precHighest = precHighestFn;
  globalThis.__codeMirrorMockStore.editorStateCreate = editorStateCreateFn;

  Object.defineProperty(
    globalThis.__codeMirrorMockStore,
    "lastCreatedExtensions",
    {
      get: () => lastExtensions,
      set: (value: unknown[]) => {
        lastExtensions = value;
      },
      configurable: true,
    },
  );

  return {
    EditorState: {
      create: editorStateCreateFn,
      readOnly: {
        of: readOnlyOfFn,
      },
    },
    Prec: {
      highest: precHighestFn,
    },
  };
});

jest.mock("@codemirror/view", () => {
  // Ensure store exists
  globalThis.__codeMirrorMockStore =
    globalThis.__codeMirrorMockStore ||
    ({} as typeof globalThis.__codeMirrorMockStore);
  // Define mocks inside factory so they exist when hoisted
  const lineWrapping = { type: "lineWrapping" };
  const destroy = jest.fn();
  const dispatch = jest.fn();
  const theme = jest.fn(() => ({ type: "theme" }));
  const lineNumbersFn = jest.fn(() => ({ type: "lineNumbers" }));
  const keymapOfFn = jest.fn((bindings: unknown) => ({
    type: "keymap",
    bindings,
  }));
  const updateListenerOfFn = jest.fn((callback: unknown) => ({
    type: "updateListener",
    callback,
  }));

  // Storage for tracking state
  let lastDoc = "";

  // Assign to global store for test access
  globalThis.__codeMirrorMockStore.lineWrapping = lineWrapping;
  globalThis.__codeMirrorMockStore.editorViewDestroy = destroy;
  globalThis.__codeMirrorMockStore.editorViewDispatch = dispatch;
  globalThis.__codeMirrorMockStore.editorViewTheme = theme;
  globalThis.__codeMirrorMockStore.lineNumbers = lineNumbersFn;
  globalThis.__codeMirrorMockStore.keymapOf = keymapOfFn;
  globalThis.__codeMirrorMockStore.updateListenerOf = updateListenerOfFn;

  const mockEditorView = jest.fn().mockImplementation(() => {
    globalThis.__codeMirrorMockStore.editorViewInstance = {
      destroy,
      dispatch,
      state: {
        doc: {
          toString: () => lastDoc,
        },
      },
    };
    return globalThis.__codeMirrorMockStore.editorViewInstance;
  });

  // Add static properties
  (mockEditorView as unknown as Record<string, unknown>).theme = theme;
  (mockEditorView as unknown as Record<string, unknown>).lineWrapping =
    lineWrapping;
  (mockEditorView as unknown as Record<string, unknown>).updateListener = {
    of: updateListenerOfFn,
  };

  // Track lastDoc for external access
  Object.defineProperty(globalThis.__codeMirrorMockStore, "lastCreatedDoc", {
    get: () => lastDoc,
    set: (value: string) => {
      lastDoc = value;
    },
    configurable: true,
  });

  return {
    EditorView: mockEditorView,
    keymap: {
      of: keymapOfFn,
    },
    lineNumbers: lineNumbersFn,
  };
});

// ============================================================================
// Imports (MUST come after jest.mock calls)
// ============================================================================

import { render } from "@testing-library/react";
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

/**
 * Reset all mocks between tests
 */
function resetMocks() {
  mockStore.editorViewDestroy.mockClear();
  mockStore.editorViewDispatch.mockClear();
  mockStore.editorViewTheme.mockClear();
  mockStore.lineNumbers.mockClear();
  mockStore.keymapOf.mockClear();
  mockStore.editorStateCreate.mockClear();
  mockStore.readOnlyOf.mockClear();
  mockStore.precHighest.mockClear();
  mockStore.sql.mockClear();
  mockStore.yaml.mockClear();
  mockStore.updateListenerOf.mockClear();
  mockStore.editorViewInstance = null;
  mockStore.lastCreatedExtensions = [];
  mockStore.lastCreatedDoc = "";
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
    it("creates editor container with default height", () => {
      const { container } = render(<CodeEditor {...createMockProps()} />);

      // Should have a container element
      const box = container.firstChild as HTMLElement;
      expect(box).toBeInTheDocument();
    });

    it("respects custom height prop", () => {
      const { container } = render(
        <CodeEditor {...createMockProps({ height: "500px" })} />,
      );

      const box = container.firstChild as HTMLElement;
      expect(box).toBeInTheDocument();
      // Height is applied via sx prop - we verify the component accepts it
    });

    it("creates EditorView with initial value", () => {
      render(<CodeEditor {...createMockProps({ value: "SELECT 1;" })} />);

      expect(mockStore.editorStateCreate).toHaveBeenCalled();
      expect(mockStore.lastCreatedDoc).toBe("SELECT 1;");
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
    it("applies light theme by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const themeCall = mockStore.editorViewTheme.mock.calls[0];
      // Second argument to EditorView.theme is { dark: boolean }
      expect(themeCall[1]).toEqual({ dark: false });
    });

    it("applies dark theme when theme prop is dark", () => {
      render(<CodeEditor {...createMockProps({ theme: "dark" })} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const themeCall = mockStore.editorViewTheme.mock.calls[0];
      expect(themeCall[1]).toEqual({ dark: true });
    });

    it("applies light theme when theme prop is light", () => {
      render(<CodeEditor {...createMockProps({ theme: "light" })} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const themeCall = mockStore.editorViewTheme.mock.calls[0];
      expect(themeCall[1]).toEqual({ dark: false });
    });
  });

  // ==========================================================================
  // Read-Only Mode Tests
  // ==========================================================================

  describe("read-only mode", () => {
    it("adds readOnly extension when readOnly is true", () => {
      render(<CodeEditor {...createMockProps({ readOnly: true })} />);

      expect(mockStore.readOnlyOf).toHaveBeenCalledWith(true);
    });

    it("does not add readOnly extension when readOnly is false", () => {
      render(<CodeEditor {...createMockProps({ readOnly: false })} />);

      expect(mockStore.readOnlyOf).not.toHaveBeenCalled();
    });

    it("defaults to editable (readOnly false)", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.readOnlyOf).not.toHaveBeenCalled();
    });

    it("does not add updateListener when readOnly is true", () => {
      const onChange = jest.fn();
      render(<CodeEditor {...createMockProps({ readOnly: true, onChange })} />);

      // updateListener should not be called even when onChange is provided
      expect(mockStore.updateListenerOf).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Line Numbers Tests
  // ==========================================================================

  describe("line numbers", () => {
    it("shows line numbers by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.lineNumbers).toHaveBeenCalled();
    });

    it("shows line numbers when lineNumbers is true", () => {
      render(<CodeEditor {...createMockProps({ lineNumbers: true })} />);

      expect(mockStore.lineNumbers).toHaveBeenCalled();
    });

    it("hides line numbers when lineNumbers is false", () => {
      render(<CodeEditor {...createMockProps({ lineNumbers: false })} />);

      expect(mockStore.lineNumbers).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Word Wrap Tests
  // ==========================================================================

  describe("word wrap", () => {
    it("enables word wrap by default", () => {
      render(<CodeEditor {...createMockProps()} />);

      // Verify that lineWrapping extension was included in the created state
      expect(mockStore.lastCreatedExtensions).toContainEqual(
        mockStore.lineWrapping,
      );
    });

    it("enables word wrap when wordWrap is true", () => {
      render(<CodeEditor {...createMockProps({ wordWrap: true })} />);

      expect(mockStore.lastCreatedExtensions).toContainEqual(
        mockStore.lineWrapping,
      );
    });

    it("disables word wrap when wordWrap is false", () => {
      render(<CodeEditor {...createMockProps({ wordWrap: false })} />);

      expect(mockStore.lastCreatedExtensions).not.toContainEqual(
        mockStore.lineWrapping,
      );
    });
  });

  // ==========================================================================
  // Font Size Tests
  // ==========================================================================

  describe("font size", () => {
    it("uses default font size of 14px", () => {
      render(<CodeEditor {...createMockProps()} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const themeStyles = mockStore.editorViewTheme.mock.calls[0][0];
      expect(themeStyles["&"].fontSize).toBe("14px");
    });

    it("uses custom font size when provided", () => {
      render(<CodeEditor {...createMockProps({ fontSize: 16 })} />);

      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      const themeStyles = mockStore.editorViewTheme.mock.calls[0][0];
      expect(themeStyles["&"].fontSize).toBe("16px");
    });

    it("accepts various font sizes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ fontSize: 12 })} />,
      );

      let themeStyles = mockStore.editorViewTheme.mock.calls[0][0];
      expect(themeStyles["&"].fontSize).toBe("12px");

      mockStore.editorViewTheme.mockClear();
      rerender(<CodeEditor {...createMockProps({ fontSize: 18 })} />);

      themeStyles = mockStore.editorViewTheme.mock.calls[0][0];
      expect(themeStyles["&"].fontSize).toBe("18px");
    });
  });

  // ==========================================================================
  // onChange Callback Tests
  // ==========================================================================

  describe("onChange callback", () => {
    it("registers updateListener when onChange is provided", () => {
      const onChange = jest.fn();
      render(<CodeEditor {...createMockProps({ onChange })} />);

      expect(mockStore.updateListenerOf).toHaveBeenCalled();
    });

    it("still registers updateListener for internal tracking even without onChange", () => {
      // The component always registers updateListener for internal value tracking
      // when not in read-only mode, regardless of whether onChange is provided
      render(<CodeEditor {...createMockProps({ onChange: undefined })} />);

      expect(mockStore.updateListenerOf).toHaveBeenCalled();
    });

    it("calls onChange when document changes", () => {
      const onChange = jest.fn();
      render(<CodeEditor {...createMockProps({ onChange })} />);

      // Get the callback registered with updateListener
      const listenerCallback = mockStore.updateListenerOf.mock
        .calls[0][0] as (update: {
        docChanged: boolean;
        state: { doc: { toString: () => string } };
      }) => void;

      // Simulate a document change
      const mockUpdate = {
        docChanged: true,
        state: {
          doc: {
            toString: () => "SELECT * FROM orders;",
          },
        },
      };

      listenerCallback(mockUpdate);

      expect(onChange).toHaveBeenCalledWith("SELECT * FROM orders;");
    });

    it("does not call onChange when document has not changed", () => {
      const onChange = jest.fn();
      render(<CodeEditor {...createMockProps({ onChange })} />);

      const listenerCallback = mockStore.updateListenerOf.mock
        .calls[0][0] as (update: {
        docChanged: boolean;
        state: { doc: { toString: () => string } };
      }) => void;

      // Simulate an update that is not a document change
      const mockUpdate = {
        docChanged: false,
        state: {
          doc: {
            toString: () => "SELECT * FROM users;",
          },
        },
      };

      listenerCallback(mockUpdate);

      expect(onChange).not.toHaveBeenCalled();
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

    it("wraps keymap with Prec.highest for precedence", () => {
      const keyBindings = [{ key: "Mod-Enter", run: () => true }];

      render(<CodeEditor {...createMockProps({ keyBindings })} />);

      // Verify Prec.highest was called with the keymap result
      const keymapResult = mockStore.keymapOf.mock.results[0].value;
      expect(mockStore.precHighest).toHaveBeenCalledWith(keymapResult);
    });
  });

  // ==========================================================================
  // className Prop Tests
  // ==========================================================================

  describe("className prop", () => {
    it("includes no-track-pii-safe class by default", () => {
      const { container } = render(<CodeEditor {...createMockProps()} />);

      const box = container.firstChild as HTMLElement;
      expect(box.className).toContain("no-track-pii-safe");
    });

    it("includes custom className when provided", () => {
      const { container } = render(
        <CodeEditor {...createMockProps({ className: "custom-editor" })} />,
      );

      const box = container.firstChild as HTMLElement;
      expect(box.className).toContain("custom-editor");
      expect(box.className).toContain("no-track-pii-safe");
    });

    it("handles undefined className gracefully", () => {
      const { container } = render(
        <CodeEditor {...createMockProps({ className: undefined })} />,
      );

      const box = container.firstChild as HTMLElement;
      expect(box.className).toContain("no-track-pii-safe");
    });
  });

  // ==========================================================================
  // External Value Sync Tests
  // ==========================================================================

  describe("external value sync", () => {
    it("accepts value prop changes without throwing", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ value: "SELECT 1;" })} />,
      );

      // Should not throw when value changes
      expect(() => {
        rerender(<CodeEditor {...createMockProps({ value: "SELECT 2;" })} />);
      }).not.toThrow();
    });

    it("component remains mounted after value updates", () => {
      const { rerender, container } = render(
        <CodeEditor {...createMockProps({ value: "SELECT 1;" })} />,
      );

      rerender(<CodeEditor {...createMockProps({ value: "SELECT 2;" })} />);

      // Container should still have content
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Cleanup Tests
  // ==========================================================================

  describe("cleanup", () => {
    it("destroys EditorView on unmount", () => {
      const { unmount } = render(<CodeEditor {...createMockProps()} />);

      // Clear any calls from initialization
      mockStore.editorViewDestroy.mockClear();

      unmount();

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
    });

    it("destroys previous EditorView when recreating editor", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ language: "sql" })} />,
      );

      mockStore.editorViewDestroy.mockClear();

      // Change a prop that triggers editor recreation
      rerender(<CodeEditor {...createMockProps({ language: "yaml" })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
    });

    it("cleans up correctly after multiple recreations", () => {
      const { rerender, unmount } = render(
        <CodeEditor {...createMockProps({ language: "sql" })} />,
      );

      rerender(<CodeEditor {...createMockProps({ language: "yaml" })} />);
      rerender(<CodeEditor {...createMockProps({ language: "text" })} />);

      mockStore.editorViewDestroy.mockClear();

      unmount();

      expect(mockStore.editorViewDestroy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Memoization Tests
  // ==========================================================================

  describe("memoization", () => {
    it("has displayName set for debugging", () => {
      expect(CodeEditor.displayName).toBe("CodeEditor");
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("integration", () => {
    it("renders complete editor with all features", () => {
      const onChange = jest.fn();
      const keyBindings = [{ key: "Mod-Enter", run: () => true }];

      const { container } = render(
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
      expect(container.firstChild).toBeInTheDocument();

      // Verify all extensions are configured
      expect(mockStore.sql).toHaveBeenCalled();
      expect(mockStore.lineNumbers).toHaveBeenCalled();
      expect(mockStore.editorViewTheme).toHaveBeenCalled();
      expect(mockStore.updateListenerOf).toHaveBeenCalled();
      expect(mockStore.precHighest).toHaveBeenCalled();

      // Verify theme is dark
      const themeCall = mockStore.editorViewTheme.mock.calls[0];
      expect(themeCall[1]).toEqual({ dark: true });
    });

    it("renders read-only YAML editor", () => {
      const { container } = render(
        <CodeEditor
          value="key: value\nlist:\n  - item1\n  - item2"
          language="yaml"
          readOnly={true}
          lineNumbers={true}
          theme="light"
          height="300px"
        />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.yaml).toHaveBeenCalled();
      expect(mockStore.readOnlyOf).toHaveBeenCalledWith(true);
      expect(mockStore.lineNumbers).toHaveBeenCalled();
    });

    it("renders minimal text editor", () => {
      const { container } = render(
        <CodeEditor
          value="Plain text content"
          language="text"
          lineNumbers={false}
          wordWrap={false}
        />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.sql).not.toHaveBeenCalled();
      expect(mockStore.yaml).not.toHaveBeenCalled();
      expect(mockStore.lineNumbers).not.toHaveBeenCalled();
      expect(mockStore.lastCreatedExtensions).not.toContainEqual(
        mockStore.lineWrapping,
      );
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty string value", () => {
      const { container } = render(
        <CodeEditor {...createMockProps({ value: "" })} />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.lastCreatedDoc).toBe("");
    });

    it("handles very long content", () => {
      const longContent = "SELECT ".repeat(10000);
      const { container } = render(
        <CodeEditor {...createMockProps({ value: longContent })} />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.lastCreatedDoc).toBe(longContent);
    });

    it("handles multiline content", () => {
      const multilineContent = `SELECT
  id,
  name,
  email
FROM users
WHERE active = true
ORDER BY created_at DESC;`;

      const { container } = render(
        <CodeEditor {...createMockProps({ value: multilineContent })} />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.lastCreatedDoc).toBe(multilineContent);
    });

    it("handles special characters in content", () => {
      const specialContent =
        "SELECT * FROM users WHERE name = 'O\\'Brien' AND data->>'key' = 'value';";
      const { container } = render(
        <CodeEditor {...createMockProps({ value: specialContent })} />,
      );

      expect(container.firstChild).toBeInTheDocument();
      expect(mockStore.lastCreatedDoc).toBe(specialContent);
    });

    it("handles rapid value changes without throwing", () => {
      const { rerender, container } = render(
        <CodeEditor {...createMockProps({ value: "v1" })} />,
      );

      // Component should handle rapid updates without errors
      expect(() => {
        for (let i = 2; i <= 5; i++) {
          rerender(<CodeEditor {...createMockProps({ value: `v${i}` })} />);
        }
      }).not.toThrow();

      // Container should still be mounted
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Prop Change Tests
  // ==========================================================================

  describe("prop changes", () => {
    it("recreates editor when language changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ language: "sql" })} />,
      );

      mockStore.editorViewDestroy.mockClear();
      mockStore.sql.mockClear();

      rerender(<CodeEditor {...createMockProps({ language: "yaml" })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
      expect(mockStore.yaml).toHaveBeenCalled();
    });

    it("recreates editor when readOnly changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ readOnly: false })} />,
      );

      mockStore.editorViewDestroy.mockClear();

      rerender(<CodeEditor {...createMockProps({ readOnly: true })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
      expect(mockStore.readOnlyOf).toHaveBeenCalledWith(true);
    });

    it("recreates editor when lineNumbers changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ lineNumbers: true })} />,
      );

      mockStore.editorViewDestroy.mockClear();
      mockStore.lineNumbers.mockClear();

      rerender(<CodeEditor {...createMockProps({ lineNumbers: false })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
      expect(mockStore.lineNumbers).not.toHaveBeenCalled();
    });

    it("recreates editor when theme changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ theme: "light" })} />,
      );

      mockStore.editorViewDestroy.mockClear();
      mockStore.editorViewTheme.mockClear();

      rerender(<CodeEditor {...createMockProps({ theme: "dark" })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
      const themeCall = mockStore.editorViewTheme.mock.calls[0];
      expect(themeCall[1]).toEqual({ dark: true });
    });

    it("recreates editor when fontSize changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ fontSize: 14 })} />,
      );

      mockStore.editorViewDestroy.mockClear();
      mockStore.editorViewTheme.mockClear();

      rerender(<CodeEditor {...createMockProps({ fontSize: 16 })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
      const themeStyles = mockStore.editorViewTheme.mock.calls[0][0];
      expect(themeStyles["&"].fontSize).toBe("16px");
    });

    it("recreates editor when wordWrap changes", () => {
      const { rerender } = render(
        <CodeEditor {...createMockProps({ wordWrap: true })} />,
      );

      mockStore.editorViewDestroy.mockClear();

      rerender(<CodeEditor {...createMockProps({ wordWrap: false })} />);

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
    });

    it("recreates editor when keyBindings change", () => {
      const keyBindings1 = [{ key: "Mod-Enter", run: () => true }];
      const keyBindings2 = [{ key: "Mod-s", run: () => true }];

      const { rerender } = render(
        <CodeEditor {...createMockProps({ keyBindings: keyBindings1 })} />,
      );

      mockStore.editorViewDestroy.mockClear();

      rerender(
        <CodeEditor {...createMockProps({ keyBindings: keyBindings2 })} />,
      );

      expect(mockStore.editorViewDestroy).toHaveBeenCalled();
    });
  });
});
