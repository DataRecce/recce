import { render, screen } from "@testing-library/react";
import { HSplit, VSplit } from "../Split";

// Mock react-split since it's a third-party component
jest.mock("react-split", () => ({
  __esModule: true,
  default: ({
    children,
    direction,
    sizes,
    minSize,
    gutterSize,
    style,
    ...rest
  }: {
    children: React.ReactNode;
    direction?: string;
    sizes?: number[];
    minSize?: number | number[];
    gutterSize?: number;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid="mock-split"
      data-direction={direction}
      data-sizes={JSON.stringify(sizes)}
      data-min-size={JSON.stringify(minSize)}
      data-gutter-size={gutterSize}
      style={style}
    >
      {children}
    </div>
  ),
}));

describe("HSplit", () => {
  test("renders children", () => {
    render(
      <HSplit>
        <div>Left Panel</div>
        <div>Right Panel</div>
      </HSplit>,
    );

    expect(screen.getByText("Left Panel")).toBeInTheDocument();
    expect(screen.getByText("Right Panel")).toBeInTheDocument();
  });

  test("sets direction to horizontal", () => {
    render(
      <HSplit>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-direction", "horizontal");
  });

  test("passes sizes prop", () => {
    render(
      <HSplit sizes={[30, 70]}>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-sizes", JSON.stringify([30, 70]));
  });

  test("passes minSize prop", () => {
    render(
      <HSplit minSize={100}>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-min-size", "100");
  });

  test("passes array minSize prop", () => {
    render(
      <HSplit minSize={[100, 200]}>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-min-size", JSON.stringify([100, 200]));
  });

  test("uses default gutterSize of 5", () => {
    render(
      <HSplit>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-gutter-size", "5");
  });

  test("allows custom gutterSize", () => {
    render(
      <HSplit gutterSize={10}>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-gutter-size", "10");
  });

  test("passes style prop", () => {
    render(
      <HSplit style={{ height: "100%" }}>
        <div>Left</div>
        <div>Right</div>
      </HSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveStyle({ height: "100%" });
  });
});

describe("VSplit", () => {
  test("renders children", () => {
    render(
      <VSplit>
        <div>Top Panel</div>
        <div>Bottom Panel</div>
      </VSplit>,
    );

    expect(screen.getByText("Top Panel")).toBeInTheDocument();
    expect(screen.getByText("Bottom Panel")).toBeInTheDocument();
  });

  test("sets direction to vertical", () => {
    render(
      <VSplit>
        <div>Top</div>
        <div>Bottom</div>
      </VSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-direction", "vertical");
  });

  test("passes sizes prop", () => {
    render(
      <VSplit sizes={[60, 40]}>
        <div>Top</div>
        <div>Bottom</div>
      </VSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-sizes", JSON.stringify([60, 40]));
  });

  test("passes minSize prop", () => {
    render(
      <VSplit minSize={50}>
        <div>Top</div>
        <div>Bottom</div>
      </VSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-min-size", "50");
  });

  test("uses default gutterSize of 5", () => {
    render(
      <VSplit>
        <div>Top</div>
        <div>Bottom</div>
      </VSplit>,
    );

    const split = screen.getByTestId("mock-split");
    expect(split).toHaveAttribute("data-gutter-size", "5");
  });
});

describe("Split integration patterns", () => {
  test("supports three-way horizontal split", () => {
    render(
      <HSplit sizes={[20, 60, 20]}>
        <div>Nav</div>
        <div>Content</div>
        <div>Details</div>
      </HSplit>,
    );

    expect(screen.getByText("Nav")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  test("supports nested splits", () => {
    render(
      <HSplit sizes={[30, 70]}>
        <div>Sidebar</div>
        <VSplit sizes={[70, 30]}>
          <div>Main Content</div>
          <div>Footer</div>
        </VSplit>
      </HSplit>,
    );

    expect(screen.getByText("Sidebar")).toBeInTheDocument();
    expect(screen.getByText("Main Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
