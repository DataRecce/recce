import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PythonDeprecationModal } from "../PythonDeprecationModal";

// Mock the instance context
const mockInstanceContext = {
  singleEnv: false,
  authed: false,
  featureToggles: { mode: null },
  pythonVersion: undefined as string | undefined,
};

vi.mock("../../../contexts", () => ({
  useRecceInstanceContext: () => mockInstanceContext,
}));

beforeEach(() => {
  sessionStorage.clear();
  mockInstanceContext.pythonVersion = undefined;
});

describe("PythonDeprecationModal", () => {
  test("renders warning dialog when Python version is 3.9", () => {
    mockInstanceContext.pythonVersion = "3.9.18";
    render(<PythonDeprecationModal />);
    expect(
      screen.getByText("Python 3.9 Deprecation Notice"),
    ).toBeInTheDocument();
  });

  test("does not render when Python version is 3.10+", () => {
    mockInstanceContext.pythonVersion = "3.10.0";
    render(<PythonDeprecationModal />);
    expect(
      screen.queryByText("Python 3.9 Deprecation Notice"),
    ).not.toBeInTheDocument();
  });

  test("does not render when pythonVersion is undefined (older backend)", () => {
    mockInstanceContext.pythonVersion = undefined;
    render(<PythonDeprecationModal />);
    expect(
      screen.queryByText("Python 3.9 Deprecation Notice"),
    ).not.toBeInTheDocument();
  });

  test("dismisses and sets sessionStorage on button click", async () => {
    mockInstanceContext.pythonVersion = "3.9.7";
    const user = userEvent.setup();
    render(<PythonDeprecationModal />);

    expect(
      screen.getByText("Python 3.9 Deprecation Notice"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /got it/i }));

    expect(
      screen.queryByText("Python 3.9 Deprecation Notice"),
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem("recce-python-deprecation-dismissed")).toBe(
      "true",
    );
  });

  test("does not render if already dismissed in session", () => {
    sessionStorage.setItem("recce-python-deprecation-dismissed", "true");
    mockInstanceContext.pythonVersion = "3.9.18";
    render(<PythonDeprecationModal />);
    expect(
      screen.queryByText("Python 3.9 Deprecation Notice"),
    ).not.toBeInTheDocument();
  });
});
