/**
 * @file StatusBadge.test.tsx
 * @description Tests for StatusBadge primitive component.
 */

import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it("renders the default label for a status", () => {
    render(<StatusBadge status="success" />);

    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("renders a custom label and timestamp", () => {
    render(
      <StatusBadge
        status="warning"
        label="Needs Review"
        timestamp="Today, 12:00"
      />,
    );

    expect(screen.getByText("Needs Review")).toBeInTheDocument();
    expect(screen.getByText("Today, 12:00")).toBeInTheDocument();
  });

  it("shows a spinner when running", () => {
    render(<StatusBadge status="running" showSpinner={true} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("hides the spinner when disabled", () => {
    render(<StatusBadge status="running" showSpinner={false} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
