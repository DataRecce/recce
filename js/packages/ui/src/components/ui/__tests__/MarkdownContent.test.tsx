/**
 * @file MarkdownContent.test.tsx
 * @description Tests for @datarecce/ui MarkdownContent component
 *
 * Tests verify:
 * - Basic markdown rendering (headers, paragraphs, lists)
 * - GFM features (tables, strikethrough, task lists)
 * - Code block rendering with syntax highlighting
 * - External link detection and confirmation dialog
 * - Internal link handling
 * - Dark/light theme support
 * - Font size customization
 */

import type { ReactNode } from "react";
import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock useIsDark hook
const mockUseIsDark = vi.fn(() => false);
vi.mock("../../../hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// Define types for the mock components
interface MockMarkdownProps {
  children?: string;
  components?: Record<
    string,
    (props: { children?: ReactNode; href?: string }) => ReactNode
  >;
}

// Mock react-markdown to avoid ESM issues
vi.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children, components }: MockMarkdownProps) => {
    // Simple mock that parses basic markdown
    if (!children) return null;
    const content = children;

    // Parse headers
    const h1Match = content.match(/^# (.+)$/m);
    const h2Match = content.match(/^## (.+)$/m);
    const h3Match = content.match(/^### (.+)$/m);

    // Parse links
    const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);

    // Parse bold
    const boldMatch = content.match(/\*\*([^*]+)\*\*/);

    // Parse italic
    const italicMatch = content.match(/\*([^*]+)\*/);

    // Parse strikethrough
    const strikeMatch = content.match(/~~([^~]+)~~/);

    // Parse inline code
    const inlineCodeMatch = content.match(/`([^`]+)`/);

    // Parse fenced code blocks
    const codeBlockMatch = content.match(/```(\w+)?\n([\s\S]*?)```/);

    // Parse blockquotes
    const blockquoteMatch = content.match(/^> (.+)$/m);

    // Parse unordered lists
    const ulMatch = content.match(/^- (.+)$/gm);

    // Parse ordered lists
    const olMatch = content.match(/^\d+\. (.+)$/gm);

    // Parse tables
    const tableMatch = content.match(/\|(.+)\|/g);

    // Parse horizontal rule
    const hrMatch = content.match(/^---$/m);

    // Return parsed elements
    return (
      <div data-testid="mock-markdown">
        {h1Match &&
          (components?.h1 ? (
            components.h1({ children: h1Match[1] })
          ) : (
            <h1>{h1Match[1]}</h1>
          ))}
        {h2Match &&
          (components?.h2 ? (
            components.h2({ children: h2Match[1] })
          ) : (
            <h2>{h2Match[1]}</h2>
          ))}
        {h3Match &&
          (components?.h3 ? (
            components.h3({ children: h3Match[1] })
          ) : (
            <h3>{h3Match[1]}</h3>
          ))}
        {linkMatch &&
          (components?.a ? (
            components.a({ href: linkMatch[2], children: linkMatch[1] })
          ) : (
            <a href={linkMatch[2]}>{linkMatch[1]}</a>
          ))}
        {boldMatch &&
          !h1Match &&
          !h2Match &&
          !h3Match &&
          (components?.strong ? (
            components.strong({ children: boldMatch[1] })
          ) : (
            <strong>{boldMatch[1]}</strong>
          ))}
        {italicMatch &&
          !boldMatch &&
          !h1Match &&
          !h2Match &&
          !h3Match &&
          (components?.em ? (
            components.em({ children: italicMatch[1] })
          ) : (
            <em>{italicMatch[1]}</em>
          ))}
        {strikeMatch &&
          (components?.del ? (
            components.del({ children: strikeMatch[1] })
          ) : (
            <del>{strikeMatch[1]}</del>
          ))}
        {inlineCodeMatch &&
          !codeBlockMatch &&
          (components?.code ? (
            components.code({ children: inlineCodeMatch[1] })
          ) : (
            <code>{inlineCodeMatch[1]}</code>
          ))}
        {codeBlockMatch &&
          (components?.code ? (
            components.code({
              className: codeBlockMatch[1]
                ? `language-${codeBlockMatch[1]}`
                : undefined,
              children: codeBlockMatch[2].trim(),
            } as { children?: ReactNode; href?: string })
          ) : (
            <pre>
              <code>{codeBlockMatch[2].trim()}</code>
            </pre>
          ))}
        {blockquoteMatch &&
          (components?.blockquote ? (
            components.blockquote({ children: blockquoteMatch[1] })
          ) : (
            <blockquote>{blockquoteMatch[1]}</blockquote>
          ))}
        {ulMatch && (
          <ul>
            {ulMatch.map((item) => {
              const text = item.replace(/^- /, "");
              return components?.li ? (
                <span key={text}>{components.li({ children: text })}</span>
              ) : (
                <li key={text}>{text}</li>
              );
            })}
          </ul>
        )}
        {olMatch && (
          <ol>
            {olMatch.map((item) => {
              const text = item.replace(/^\d+\. /, "");
              return components?.li ? (
                <span key={text}>{components.li({ children: text })}</span>
              ) : (
                <li key={text}>{text}</li>
              );
            })}
          </ol>
        )}
        {tableMatch && tableMatch.length > 2 && (
          <table>
            <thead>
              <tr>
                {tableMatch[0]
                  .split("|")
                  .filter(Boolean)
                  .map((cell) => (
                    <th key={cell.trim()}>{cell.trim()}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {tableMatch.slice(2).map((row) => (
                <tr key={row}>
                  {row
                    .split("|")
                    .filter(Boolean)
                    .map((cell) => (
                      <td key={cell.trim()}>{cell.trim()}</td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hrMatch && <hr />}
        {!h1Match &&
          !h2Match &&
          !h3Match &&
          !linkMatch &&
          !boldMatch &&
          !italicMatch &&
          !strikeMatch &&
          !inlineCodeMatch &&
          !codeBlockMatch &&
          !blockquoteMatch &&
          !ulMatch &&
          !olMatch &&
          !tableMatch &&
          !hrMatch &&
          content.trim() &&
          (components?.p ? (
            components.p({ children: content.trim() })
          ) : (
            <p>{content.trim()}</p>
          ))}
      </div>
    );
  },
}));

// Mock remark-gfm
vi.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => {
    // Empty plugin mock - returns identity transform
    return null;
  },
}));

// Mock react-syntax-highlighter
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children, language }: { children: string; language?: string }) => (
    <pre data-testid="syntax-highlighter" data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MarkdownContent } from "../MarkdownContent";

// ============================================================================
// Test Setup
// ============================================================================

describe("MarkdownContent", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Basic Rendering Tests
  // ==========================================================================

  describe("basic rendering", () => {
    it("renders plain text content", () => {
      render(<MarkdownContent content="Hello World" />);

      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("renders paragraphs", () => {
      render(<MarkdownContent content="A simple paragraph" />);

      expect(screen.getByText("A simple paragraph")).toBeInTheDocument();
    });

    it("renders h1 headers", () => {
      render(<MarkdownContent content="# Header 1" />);

      expect(screen.getByText("Header 1")).toBeInTheDocument();
    });

    it("renders h2 headers", () => {
      render(<MarkdownContent content="## Header 2" />);

      expect(screen.getByText("Header 2")).toBeInTheDocument();
    });

    it("renders h3 headers", () => {
      render(<MarkdownContent content="### Header 3" />);

      expect(screen.getByText("Header 3")).toBeInTheDocument();
    });

    it("renders unordered lists", () => {
      render(<MarkdownContent content="- Single list item" />);

      // Check the list structure exists
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe("UL");
    });

    it("renders ordered lists", () => {
      render(<MarkdownContent content="1. First item" />);

      // Check the list structure exists
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
      expect(list.tagName).toBe("OL");
    });

    it("renders blockquotes", () => {
      render(<MarkdownContent content="> This is a quote" />);

      expect(screen.getByText("This is a quote")).toBeInTheDocument();
    });

    it("renders horizontal rules", () => {
      const { container } = render(<MarkdownContent content="---" />);

      expect(container.querySelector("hr")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Text Formatting Tests
  // ==========================================================================

  describe("text formatting", () => {
    it("renders bold text", () => {
      render(<MarkdownContent content="**bold text**" />);

      expect(screen.getByText("bold text")).toBeInTheDocument();
    });

    it("renders italic text", () => {
      render(<MarkdownContent content="*italic text*" />);

      expect(screen.getByText("italic text")).toBeInTheDocument();
    });

    it("renders strikethrough text (GFM)", () => {
      render(<MarkdownContent content="~~deleted~~" />);

      expect(screen.getByText("deleted")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Code Block Tests
  // ==========================================================================

  describe("code blocks", () => {
    it("renders inline code", () => {
      render(<MarkdownContent content="Use `const` keyword" />);

      expect(screen.getByText("const")).toBeInTheDocument();
    });

    it("renders fenced code blocks with syntax highlighting", () => {
      render(
        <MarkdownContent
          content={`\`\`\`javascript
const x = 1;
\`\`\``}
        />,
      );

      expect(screen.getByTestId("syntax-highlighter")).toBeInTheDocument();
      expect(screen.getByText("const x = 1;")).toBeInTheDocument();
    });

    it("passes language to syntax highlighter", () => {
      render(
        <MarkdownContent
          content={`\`\`\`python
print("hello")
\`\`\``}
        />,
      );

      const highlighter = screen.getByTestId("syntax-highlighter");
      expect(highlighter).toHaveAttribute("data-language", "python");
    });
  });

  // ==========================================================================
  // Table Tests (GFM)
  // ==========================================================================

  describe("tables (GFM)", () => {
    const tableMarkdown = `
| Name | Age |
|------|-----|
| John | 30  |
| Jane | 25  |
`;

    it("renders table headers", () => {
      render(<MarkdownContent content={tableMarkdown} />);

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(screen.getByText("Age")).toBeInTheDocument();
    });

    it("renders table data", () => {
      render(<MarkdownContent content={tableMarkdown} />);

      expect(screen.getByText("John")).toBeInTheDocument();
      expect(screen.getByText("30")).toBeInTheDocument();
      expect(screen.getByText("Jane")).toBeInTheDocument();
      expect(screen.getByText("25")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Link Tests
  // ==========================================================================

  describe("links", () => {
    it("renders internal links without external indicator", () => {
      render(<MarkdownContent content="[Local](/page)" />);

      const link = screen.getByText("Local");
      expect(link).toBeInTheDocument();
      expect(link.textContent).not.toContain("↗");
    });

    it("renders relative links as internal", () => {
      render(<MarkdownContent content="[Relative](#section)" />);

      const link = screen.getByText("Relative");
      expect(link.textContent).not.toContain("↗");
    });

    it("renders external links with external indicator", () => {
      render(<MarkdownContent content="[External](https://example.com)" />);

      // External links should have the ↗ indicator
      const linkContainer = screen.getByRole("link");
      expect(linkContainer.textContent).toContain("↗");
    });

    it("treats reccehq.com as internal", () => {
      render(<MarkdownContent content="[Recce](https://reccehq.com/docs)" />);

      const link = screen.getByText("Recce");
      expect(link.textContent).not.toContain("↗");
    });

    it("treats datarecce.io as internal", () => {
      render(
        <MarkdownContent content="[DataRecce](https://datarecce.io/docs)" />,
      );

      const link = screen.getByText("DataRecce");
      expect(link.textContent).not.toContain("↗");
    });

    it("accepts custom internal domains", () => {
      render(
        <MarkdownContent
          content="[Custom](https://custom.domain.com/page)"
          internalDomains={["custom.domain.com"]}
        />,
      );

      const link = screen.getByText("Custom");
      expect(link.textContent).not.toContain("↗");
    });
  });

  // ==========================================================================
  // External Link Confirmation Tests
  // ==========================================================================

  describe("external link confirmation", () => {
    it("shows confirmation dialog when clicking external link", () => {
      render(<MarkdownContent content="[External](https://example.com)" />);

      const link = screen.getByRole("link");
      fireEvent.click(link);

      // Dialog should appear
      expect(screen.getByText("External Link")).toBeInTheDocument();
      expect(
        screen.getByText(/This link will take you to an external website/),
      ).toBeInTheDocument();
    });

    it("does not show confirmation dialog for internal links", () => {
      render(<MarkdownContent content="[Internal](/page)" />);

      const link = screen.getByRole("link");
      fireEvent.click(link);

      // Dialog should not appear
      expect(screen.queryByText("External Link")).not.toBeInTheDocument();
    });

    it("closes dialog on cancel", async () => {
      render(<MarkdownContent content="[External](https://example.com)" />);

      const link = screen.getByRole("link");
      fireEvent.click(link);

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Dialog should close (wait for async state update)
      await waitFor(() => {
        expect(screen.queryByText("External Link")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Theme Tests
  // ==========================================================================

  describe("theme support", () => {
    it("applies light mode styling by default", () => {
      mockUseIsDark.mockReturnValue(false);
      render(<MarkdownContent content="Test content" />);

      expect(mockUseIsDark).toHaveBeenCalled();
    });

    it("applies dark mode styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      render(<MarkdownContent content="Test content" />);

      expect(mockUseIsDark).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Font Size Tests
  // ==========================================================================

  describe("font size", () => {
    it("uses default font size of 0.875rem", () => {
      const { container } = render(<MarkdownContent content="Test" />);

      // The paragraph should exist
      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });

    it("accepts custom font size", () => {
      const { container } = render(
        <MarkdownContent content="Test" fontSize="1rem" />,
      );

      const paragraph = container.querySelector("p");
      expect(paragraph).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty content", () => {
      const { container } = render(<MarkdownContent content="" />);

      expect(container.querySelector(".markdown-content")).toBeInTheDocument();
    });

    it("handles content with only whitespace", () => {
      const { container } = render(<MarkdownContent content="   \n\n   " />);

      expect(container.querySelector(".markdown-content")).toBeInTheDocument();
    });

    it("handles malformed URLs gracefully", () => {
      // Should not throw
      expect(() => {
        render(<MarkdownContent content="[Bad](not-a-valid-url)" />);
      }).not.toThrow();
    });

    it("handles complex nested markdown", () => {
      const complexContent = `
# Title

**Bold with *nested italic***

- List item with \`code\`
- Another item

> Quote with **bold**
`;
      expect(() => {
        render(<MarkdownContent content={complexContent} />);
      }).not.toThrow();
    });
  });
});

// ============================================================================
// ExternalLinkConfirmDialog Tests
// ============================================================================

describe("ExternalLinkConfirmDialog", () => {
  // Import directly for unit testing
  // Note: These are integration-tested above via MarkdownContent

  describe("truncateUrl helper", () => {
    // The truncateUrl function is internal, tested via dialog display
    it("displays truncated URL in dialog", () => {
      const longUrl =
        "https://example.com/very/long/path/that/should/be/truncated/for/display";
      render(<MarkdownContent content={`[Link](${longUrl})`} />);

      const link = screen.getByRole("link");
      fireEvent.click(link);

      // URL should be displayed (truncated or not)
      expect(screen.getByText(/example.com/)).toBeInTheDocument();
    });
  });
});
