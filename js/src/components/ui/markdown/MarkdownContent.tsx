/**
 * MarkdownContent - Renders GitHub-flavored Markdown content.
 *
 * Features:
 * - GFM support (tables, task lists, strikethrough, autolinks)
 * - Syntax highlighting for code blocks
 * - External link confirmation dialog
 * - XSS-safe rendering (no dangerouslySetInnerHTML)
 */

import React, { useState } from "react";
import Markdown, { Components } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { Box, Code, Link, Text } from "@/components/ui/mui";
import { ExternalLinkConfirmDialog } from "./ExternalLinkConfirmDialog";

interface MarkdownContentProps {
  /** The markdown content to render */
  content: string;
  /** Font size for the rendered content */
  fontSize?: string;
  /** Base URL for determining internal links (defaults to window.location.origin) */
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
        color="blue.500"
        textDecoration="underline"
        _hover={{ color: "blue.600" }}
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
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
  node?: unknown;
}) {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : undefined;
  const codeString = String(children).replace(/\n$/, "");

  // Check if this is an inline code block (no language, single line, no newlines)
  const isInline = !match && !String(children).includes("\n");

  if (isInline) {
    return (
      <Code
        bg="gray.100"
        px={1}
        py={0.5}
        borderRadius="sm"
        fontSize="0.9em"
        {...props}
      >
        {children}
      </Code>
    );
  }

  return (
    <Box my={2} borderRadius="md" overflow="hidden" fontSize="sm">
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

export function MarkdownContent({
  content,
  fontSize = "sm",
  internalDomains = [],
}: MarkdownContentProps) {
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
    code: CodeBlock,

    // Paragraphs
    p: ({ children }) => (
      <Text fontSize={fontSize} mb={2} _last={{ mb: 0 }}>
        {children}
      </Text>
    ),

    // Headers
    h1: ({ children }) => (
      <Text fontSize="xl" fontWeight="bold" mb={2} mt={3}>
        {children}
      </Text>
    ),
    h2: ({ children }) => (
      <Text fontSize="lg" fontWeight="bold" mb={2} mt={3}>
        {children}
      </Text>
    ),
    h3: ({ children }) => (
      <Text fontSize="md" fontWeight="semibold" mb={2} mt={2}>
        {children}
      </Text>
    ),

    // Lists
    ul: ({ children }) => (
      <Box as="ul" pl={4} mb={2} listStyleType="disc">
        {children}
      </Box>
    ),
    ol: ({ children }) => (
      <Box as="ol" pl={4} mb={2} listStyleType="decimal">
        {children}
      </Box>
    ),
    li: ({ children }) => (
      <Box as="li" fontSize={fontSize} mb={1}>
        {children}
      </Box>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <Box
        borderLeftWidth="3px"
        borderLeftColor="gray.300"
        pl={3}
        py={1}
        my={2}
        color="gray.600"
        fontStyle="italic"
      >
        {children}
      </Box>
    ),

    // Tables
    table: ({ children }) => (
      <Box overflowX="auto" my={2}>
        <Box
          as="table"
          width="100%"
          fontSize={fontSize}
          borderWidth="1px"
          borderColor="gray.200"
          borderRadius="md"
        >
          {children}
        </Box>
      </Box>
    ),
    thead: ({ children }) => (
      <Box as="thead" bg="gray.50">
        {children}
      </Box>
    ),
    tbody: ({ children }) => <Box as="tbody">{children}</Box>,
    tr: ({ children }) => (
      <Box as="tr" borderBottomWidth="1px" borderColor="gray.200">
        {children}
      </Box>
    ),
    th: ({ children }) => (
      <Box as="th" px={2} py={1} fontWeight="semibold" textAlign="left">
        {children}
      </Box>
    ),
    td: ({ children }) => (
      <Box as="td" px={2} py={1}>
        {children}
      </Box>
    ),

    // Horizontal rule
    hr: () => <Box as="hr" my={3} borderColor="gray.200" />,

    // Strong/Bold
    strong: ({ children }) => (
      <Text as="strong" fontWeight="semibold">
        {children}
      </Text>
    ),

    // Emphasis/Italic
    em: ({ children }) => (
      <Text as="em" fontStyle="italic">
        {children}
      </Text>
    ),

    // Strikethrough
    del: ({ children }) => (
      <Text as="del" textDecoration="line-through" color="gray.500">
        {children}
      </Text>
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
