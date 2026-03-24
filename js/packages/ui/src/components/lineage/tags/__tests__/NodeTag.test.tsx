import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NodeTag } from "../NodeTag";

const mockIsDark = vi.fn(() => false);
vi.mock("../../../../hooks/useIsDark", () => ({
  useIsDark: () => mockIsDark(),
}));

describe("NodeTag", () => {
  beforeEach(() => {
    mockIsDark.mockReturnValue(false);
  });

  describe("resource type display", () => {
    it("renders resource type text", () => {
      render(<NodeTag resourceType="source" />);
      expect(screen.getByText("source")).toBeInTheDocument();
    });

    it("renders different resource types", () => {
      const { rerender } = render(<NodeTag resourceType="source" />);
      expect(screen.getByText("source")).toBeInTheDocument();

      rerender(<NodeTag resourceType="seed" />);
      expect(screen.getByText("seed")).toBeInTheDocument();

      rerender(<NodeTag resourceType="snapshot" />);
      expect(screen.getByText("snapshot")).toBeInTheDocument();

      rerender(<NodeTag resourceType="metric" />);
      expect(screen.getByText("metric")).toBeInTheDocument();

      rerender(<NodeTag resourceType="exposure" />);
      expect(screen.getByText("exposure")).toBeInTheDocument();

      rerender(<NodeTag resourceType="semantic_model" />);
      expect(screen.getByText("semantic_model")).toBeInTheDocument();
    });

    it("renders model as resource type when no materialization", () => {
      render(<NodeTag resourceType="model" />);
      expect(screen.getByText("model")).toBeInTheDocument();
    });

    it("handles undefined resource type", () => {
      render(<NodeTag />);
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    });
  });

  describe("materialization display", () => {
    it("shows materialization for models", () => {
      render(<NodeTag resourceType="model" materialized="table" />);
      expect(screen.getByText("table")).toBeInTheDocument();
    });

    it("shows display labels for known materializations", () => {
      render(<NodeTag resourceType="model" materialized="materialized_view" />);
      expect(screen.getByText("mat. view")).toBeInTheDocument();
    });

    it("ignores materialization for non-model resources", () => {
      render(<NodeTag resourceType="source" materialized="table" />);
      expect(screen.getByText("source")).toBeInTheDocument();
      expect(screen.queryByText("table")).not.toBeInTheDocument();
    });
  });

  describe("data-testid", () => {
    it("renders with data-testid", () => {
      render(<NodeTag resourceType="model" data-testid="test-tag" />);
      expect(screen.getByTestId("test-tag")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("calls useIsDark and renders in light mode", () => {
      mockIsDark.mockReturnValue(false);
      const { container } = render(<NodeTag resourceType="model" />);
      expect(container.firstChild).toBeInTheDocument();
      expect(mockIsDark).toHaveBeenCalled();
    });

    it("calls useIsDark and renders in dark mode", () => {
      mockIsDark.mockReturnValue(true);
      const { container } = render(<NodeTag resourceType="model" />);
      expect(container.firstChild).toBeInTheDocument();
      expect(mockIsDark).toHaveBeenCalled();
    });
  });

  describe("icon display", () => {
    it("renders icon for model type", () => {
      const { container } = render(<NodeTag resourceType="model" />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("renders icon for source type", () => {
      const { container } = render(<NodeTag resourceType="source" />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("does not render icon for unknown resource type", () => {
      const { container } = render(<NodeTag resourceType="unknown_type" />);
      expect(container.querySelector("svg")).not.toBeInTheDocument();
    });

    it("renders materialization icon for model with materialization", () => {
      const { container } = render(
        <NodeTag resourceType="model" materialized="incremental" />,
      );
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });
});
