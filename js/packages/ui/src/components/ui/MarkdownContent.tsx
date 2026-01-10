"use client";

/**
 * MarkdownContent - Renders GitHub-flavored Markdown content.
 *
 * Features:
 * - GFM support (tables, task lists, strikethrough, autolinks)
 * - Syntax highlighting for code blocks
 * - External link confirmation dialog
 * - XSS-safe rendering (no dangerouslySetInnerHTML)
 */

import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import React, { useState } from "react";
import Markdown, { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useIsDark } from "../../hooks";
import { ExternalLinkConfirmDialog } from "./ExternalLinkConfirmDialog";

/**
 * Props for MarkdownContent component
 */
export interface MarkdownContentProps {
  /** The markdown content to render */
  content: string;
  /** Font size for the rendered content */
  fontSize?: string;
  /** Additional domains to treat as internal (not showing confirmation) */
  internalDomains?: string[];
}

/**
 * Check if a URL is external (not part of the Recce application)
 */
function isExternalUrl(href: string, internalDomains: string[]): boolean {
  if (!href) return false;

  // Relative URLs are internal
  if (href.startsWith("/") || href.startsWith("#") || href.startsWith("?")) {
    return false;
  }

  // Check for protocol-relative or absolute URLs
  try {
    const url = new URL(href, window.location.origin);

    // Check if the hostname matches any internal domain
    return !internalDomains.some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    // If URL parsing fails, treat as internal (likely a relative path)
    return false;
  }
}

/**
 * Custom link component that shows confirmation for external links
 */
function MarkdownLink({
  href,
  children,
  internalDomains,
}: {
  href?: string;
  children?: React.ReactNode;
  internalDomains: string[];
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href) return;

    if (isExternalUrl(href, internalDomains)) {
      e.preventDefault();
      setPendingUrl(href);
      setShowConfirm(true);
    }
  };

  const handleConfirm = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank", "noopener,noreferrer");
    }
    setShowConfirm(false);
    setPendingUrl(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingUrl(null);
  };

  const isExternal = href ? isExternalUrl(href, internalDomains) : false;

  return (
    <>
      <Link
        href={href}
        onClick={handleClick}
        sx={{
          color: "primary.main",
          textDecoration: "underline",
          "&:hover": { color: "iochmara.600" },
        }}
        target="_blank"
        rel={isExternal ? "noopener noreferrer" : undefined}
      >
        {children}
        {isExternal && " ↗"}
      </Link>
      <ExternalLinkConfirmDialog
        isOpen={showConfirm}
        url={pendingUrl || ""}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

/**
 * Custom code block component with syntax highlighting
 */
function CodeBlock({
  className,
  children,
  isDark = false,
}: {
  className?: string;
  children?: React.ReactNode;
  node?: unknown;
  isDark?: boolean;
}) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : undefined;
  const codeString = String(children).replace(/\n$/, "");

  // Check if this is an inline code block (no language, single line, no newlines)
  const isInline = !match && !String(children).includes("\n");

  if (isInline) {
    return (
      <Box
        component="code"
        sx={{
          bgcolor: isDark ? "grey.800" : "grey.100",
          color: isDark ? "grey.200" : "inherit",
          px: 1,
          py: 0.5,
          borderRadius: 0.5,
          fontSize: "0.9em",
          fontFamily: "monospace",
        }}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      sx={{ my: 2, borderRadius: 1, overflow: "hidden", fontSize: "0.875rem" }}
    >
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "6px",
          fontSize: "0.85em",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </Box>
  );
}

/**
 * MarkdownContent Component
 *
 * A component for rendering GitHub-flavored Markdown with syntax highlighting
 * and external link confirmation.
 *
 * @example Basic usage
 * ```tsx
 * import { MarkdownContent } from '@datarecce/ui/primitives';
 *
 * function Description({ text }) {
 *   return <MarkdownContent content={text} />;
 * }
 * ```
 *
 * @example With custom font size
 * ```tsx
 * <MarkdownContent content={markdown} fontSize="1rem" />
 * ```
 *
 * @example With additional internal domains
 * ```tsx
 * <MarkdownContent
 *   content={markdown}
 *   internalDomains={['company.com', 'docs.company.com']}
 * />
 * ```
 */
export function MarkdownContent({
  content,
  fontSize = "0.875rem",
  internalDomains = [],
}: MarkdownContentProps) {
  const isDark = useIsDark();

  // Build the list of internal domains
  const allInternalDomains = [
    window.location.hostname,
    "reccehq.com",
    "datarecce.io",
    "localhost",
    ...internalDomains,
  ];

  // Custom component renderers
  const components: Components = {
    // Links with external confirmation
    a: ({ href, children }) => (
      <MarkdownLink href={href} internalDomains={allInternalDomains}>
        {children}
      </MarkdownLink>
    ),

    // Code blocks with syntax highlighting
    code: (props) => <CodeBlock {...props} isDark={isDark} />,

    // Paragraphs
    p: ({ children }) => (
      <Typography
        component="p"
        sx={{ fontSize, mb: 2, "&:last-child": { mb: 0 } }}
      >
        {children}
      </Typography>
    ),

    // Headers
    h1: ({ children }) => (
      <Typography
        sx={{ fontSize: "1.25rem", fontWeight: "bold", mb: 2, mt: 3 }}
      >
        {children}
      </Typography>
    ),
    h2: ({ children }) => (
      <Typography
        sx={{ fontSize: "1.125rem", fontWeight: "bold", mb: 2, mt: 3 }}
      >
        {children}
      </Typography>
    ),
    h3: ({ children }) => (
      <Typography sx={{ fontSize: "1rem", fontWeight: 600, mb: 2, mt: 2 }}>
        {children}
      </Typography>
    ),

    // Lists
    ul: ({ children }) => (
      <Box component="ul" sx={{ pl: 4, mb: 2, listStyleType: "disc" }}>
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box component="ol" sx={{ pl: 4, mb: 2, listStyleType: "decimal" }}>
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box component="li" sx={{ fontSize, mb: 1 }}>
        {children}
      </Box>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <Box
        sx={{
          borderLeft: "3px solid",
          borderLeftColor: isDark ? "grey.600" : "grey.300",
          pl: 3,
          py: 1,
          my: 2,
          color: isDark ? "grey.400" : "grey.600",
          fontStyle: "italic",
        }}
      >
        {children}
      </Box>
    ),

    // Tables
    table: ({ children }) => (
      <Box sx={{ overflowX: "auto", my: 2 }}>
        <Box
          component="table"
          sx={{
            width: "100%",
            fontSize,
            border: "1px solid",
            borderColor: isDark ? "grey.700" : "grey.200",
            borderRadius: 1,
          }}
        >
          {children}
        </Box>
      </Box>
    ),
    thead: ({ children }) => (
      <Box component="thead" sx={{ bgcolor: isDark ? "grey.800" : "grey.50" }}>
        {children}
      </Box>
    ),
    tbody: ({ children }) => <Box component="tbody">{children}</Box>,
    tr: ({ children }) => (
      <Box
        component="tr"
        sx={{
          borderBottom: "1px solid",
          borderColor: isDark ? "grey.700" : "grey.200",
        }}
      >
        {children}
      </Box>
    ),
    th: ({ children }) => (
      <Box
        component="th"
        sx={{ px: 2, py: 1, fontWeight: 600, textAlign: "left" }}
      >
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box component="td" sx={{ px: 2, py: 1 }}>
        {children}
      </Box>
    ),

    // Horizontal rule
    hr: () => (
      <Box
        component="hr"
        sx={{ my: 3, borderColor: isDark ? "grey.700" : "grey.200" }}
      />
    ),

    // Strong/Bold
    strong: ({ children }) => (
      <Typography component="strong" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
    ),

    // Emphasis/Italic
    em: ({ children }) => (
      <Typography component="em" sx={{ fontStyle: "italic" }}>
        {children}
      </Typography>
    ),

    // Strikethrough
    del: ({ children }) => (
      <Typography
        component="del"
        sx={{ textDecoration: "line-through", color: "grey.500" }}
      >
        {children}
      </Typography>
    ),
  };

  return (
    <Box className="markdown-content">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </Box>
  );
}
