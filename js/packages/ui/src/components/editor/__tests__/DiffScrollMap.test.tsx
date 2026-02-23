/**
 * @file DiffScrollMap.test.tsx
 * @description Tests for DiffScrollMap component
 *
 * Tests verify:
 * - Rendering of marks for each entry
 * - Empty marks array renders nothing
 * - Color coding by mark type (added, deleted, modified)
 * - Positioning via top percentage
 * - Minimum visible height for tiny marks
 * - Dark mode color adjustments
 * - Hover opacity behavior
 * - Accessibility (aria-labels)
 * - onMarkClick callback
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiffScrollMap, type ScrollMapMark } from "../DiffScrollMap";

// ============================================================================
// Test Fixtures
// ============================================================================

const sampleMarks: ScrollMapMark[] = [
  { topPercent: 10, heightPercent: 5, type: "added" },
  { topPercent: 40, heightPercent: 3, type: "deleted" },
  { topPercent: 70, heightPercent: 8, type: "modified" },
];

// ============================================================================
// Tests
// ============================================================================

describe("DiffScrollMap", () => {
  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders a mark for each entry", () => {
      render(<DiffScrollMap marks={sampleMarks} />);
      const marks = screen.getAllByRole("button");
      expect(marks).toHaveLength(3);
    });

    it("renders nothing when marks is empty", () => {
      const { container } = render(<DiffScrollMap marks={[]} />);
      expect(container.querySelectorAll("button")).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Mark Color Tests
  // ==========================================================================

  describe("mark colors", () => {
    it("uses green for added marks", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark.style.backgroundColor).toMatch(
        /green|#4caf50|rgb\(76, 175, 80\)/i,
      );
    });

    it("uses red for deleted marks", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "deleted" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark.style.backgroundColor).toMatch(
        /red|#f44336|rgb\(244, 67, 54\)/i,
      );
    });

    it("uses yellow for modified marks", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "modified" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark.style.backgroundColor).toMatch(
        /yellow|#ffc107|rgb\(255, 193, 7\)/i,
      );
    });
  });

  // ==========================================================================
  // Positioning Tests
  // ==========================================================================

  describe("positioning", () => {
    it("positions marks using top percentage", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 25, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark.style.top).toBe("25%");
    });

    it("sizes marks using height percentage with minimum", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 0.1, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      // Should have a minimum visible height (at least 2px via minHeight)
      expect(mark.style.minHeight).toBe("2px");
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe("dark mode", () => {
    it("uses dark green for added marks in dark mode", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
          isDark
        />,
      );
      const mark = screen.getByRole("button");
      // Dark mode added: #66bb6a (differs from light mode #4caf50)
      expect(mark.style.backgroundColor).toBe("#66bb6a");
    });

    it("uses dark red for deleted marks in dark mode", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "deleted" }]}
          isDark
        />,
      );
      const mark = screen.getByRole("button");
      // Dark mode deleted: #ef5350 (differs from light mode #f44336)
      expect(mark.style.backgroundColor).toBe("#ef5350");
    });

    it("uses dark yellow for modified marks in dark mode", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "modified" }]}
          isDark
        />,
      );
      const mark = screen.getByRole("button");
      // Dark mode modified: #ffca28 (differs from light mode #ffc107)
      expect(mark.style.backgroundColor).toBe("#ffca28");
    });
  });

  // ==========================================================================
  // Hover Opacity Tests
  // ==========================================================================

  describe("hover opacity", () => {
    it("starts with 0.8 opacity", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark.style.opacity).toBe("0.8");
    });

    it("increases opacity to 1 on pointer enter", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      fireEvent.pointerEnter(mark);
      expect(mark.style.opacity).toBe("1");
    });

    it("restores opacity to 0.8 on pointer leave", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      fireEvent.pointerEnter(mark);
      fireEvent.pointerLeave(mark);
      expect(mark.style.opacity).toBe("0.8");
    });
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe("accessibility", () => {
    it("adds aria-label with mark type and position", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 25, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark).toHaveAttribute("aria-label", "added change at 25%");
    });

    it("rounds topPercent in aria-label", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 33.7, heightPercent: 5, type: "deleted" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(mark).toHaveAttribute("aria-label", "deleted change at 34%");
    });
  });

  // ==========================================================================
  // onMarkClick Callback Tests
  // ==========================================================================

  describe("onMarkClick callback", () => {
    it("calls onMarkClick with topPercent when mark is clicked", () => {
      const onMarkClick = vi.fn();
      render(
        <DiffScrollMap
          marks={[{ topPercent: 42, heightPercent: 5, type: "modified" }]}
          onMarkClick={onMarkClick}
        />,
      );
      const mark = screen.getByRole("button");
      fireEvent.click(mark);
      expect(onMarkClick).toHaveBeenCalledWith(42);
      expect(onMarkClick).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onMarkClick is not provided", () => {
      render(
        <DiffScrollMap
          marks={[{ topPercent: 10, heightPercent: 5, type: "added" }]}
        />,
      );
      const mark = screen.getByRole("button");
      expect(() => fireEvent.click(mark)).not.toThrow();
    });
  });
});
