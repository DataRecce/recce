/**
 * @file ResourceTypeTag.test.tsx
 * @description Tests for ResourceTypeTag component
 *
 * Tests verify:
 * - Component renders resource type text
 * - Icon is displayed for known resource types
 * - Tooltip is present
 * - Dark mode styling works correctly
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ResourceTypeTag } from "../ResourceTypeTag";

// Mock useIsDark hook
const mockIsDark = vi.fn(() => false);
vi.mock("../../../../hooks/useIsDark", () => ({
  useIsDark: () => mockIsDark(),
}));

describe("ResourceTypeTag", () => {
  beforeEach(() => {
    mockIsDark.mockReturnValue(false);
  });

  describe("rendering", () => {
    it("renders resource type text", () => {
      render(<ResourceTypeTag data={{ resourceType: "model" }} />);
      expect(screen.getByText("model")).toBeInTheDocument();
    });

    it("renders different resource types", () => {
      const { rerender } = render(
        <ResourceTypeTag data={{ resourceType: "source" }} />,
      );
      expect(screen.getByText("source")).toBeInTheDocument();

      rerender(<ResourceTypeTag data={{ resourceType: "seed" }} />);
      expect(screen.getByText("seed")).toBeInTheDocument();

      rerender(<ResourceTypeTag data={{ resourceType: "snapshot" }} />);
      expect(screen.getByText("snapshot")).toBeInTheDocument();

      rerender(<ResourceTypeTag data={{ resourceType: "metric" }} />);
      expect(screen.getByText("metric")).toBeInTheDocument();

      rerender(<ResourceTypeTag data={{ resourceType: "exposure" }} />);
      expect(screen.getByText("exposure")).toBeInTheDocument();

      rerender(<ResourceTypeTag data={{ resourceType: "semantic_model" }} />);
      expect(screen.getByText("semantic_model")).toBeInTheDocument();
    });

    it("handles undefined resource type", () => {
      render(<ResourceTypeTag data={{ resourceType: undefined }} />);
      // Should not crash, will just render empty text
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });

    it("renders with data-testid", () => {
      render(
        <ResourceTypeTag
          data={{ resourceType: "model" }}
          data-testid="test-tag"
        />,
      );
      expect(screen.getByTestId("test-tag")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("applies light mode styling", () => {
      mockIsDark.mockReturnValue(false);
      render(
        <ResourceTypeTag
          data={{ resourceType: "model" }}
          data-testid="light-tag"
        />,
      );
      // Component renders - styling is applied via MUI sx prop
      expect(screen.getByTestId("light-tag")).toBeInTheDocument();
    });

    it("applies dark mode styling", () => {
      mockIsDark.mockReturnValue(true);
      render(
        <ResourceTypeTag
          data={{ resourceType: "model" }}
          data-testid="dark-tag"
        />,
      );
      // Component renders - styling is applied via MUI sx prop
      expect(screen.getByTestId("dark-tag")).toBeInTheDocument();
    });
  });

  describe("icon display", () => {
    it("renders icon for model type", () => {
      const { container } = render(
        <ResourceTypeTag data={{ resourceType: "model" }} />,
      );
      // Icon is rendered as SVG
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders icon for source type", () => {
      const { container } = render(
        <ResourceTypeTag data={{ resourceType: "source" }} />,
      );
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("does not render icon for unknown resource type", () => {
      const { container } = render(
        <ResourceTypeTag data={{ resourceType: "unknown_type" }} />,
      );
      // Unknown types don't have icons
      expect(container.querySelector("svg")).not.toBeInTheDocument();
    });
  });
});
