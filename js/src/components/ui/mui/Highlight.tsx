"use client";

import { forwardRef } from "react";

/**
 * Highlight Component - MUI equivalent of Chakra's Highlight
 *
 * A component that highlights specific text within children.
 */

export interface HighlightProps {
  children: string;
  query: string | string[];
  styles?: Record<string, unknown>;
}

export const Highlight = forwardRef<HTMLSpanElement, HighlightProps>(
  function Highlight({ children, query, styles = {} }, ref) {
    const queries = Array.isArray(query) ? query : [query];

    // Escape special regex characters
    const escapeRegex = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Build regex pattern
    const pattern = queries.map(escapeRegex).join("|");

    if (!pattern) {
      return <span ref={ref}>{children}</span>;
    }

    const regex = new RegExp(`(${pattern})`, "gi");
    const parts = children.split(regex);

    return (
      <span ref={ref}>
        {parts.map((part) => {
          const isHighlighted = queries.some(
            (q) => q.toLowerCase() === part.toLowerCase(),
          );
          if (isHighlighted) {
            return (
              <mark
                key={part}
                style={{
                  backgroundColor: "#FEEBC8",
                  padding: "0 2px",
                  ...styles,
                }}
              >
                {part}
              </mark>
            );
          }
          return part;
        })}
      </span>
    );
  },
);

export default Highlight;
