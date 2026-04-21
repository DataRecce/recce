/**
 * @file ProfileModeToggle.test.tsx
 * @description Tests for the 3-way render-mode segmented control.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileModeToggle } from "../ProfileModeToggle";

describe("ProfileModeToggle", () => {
  it("renders three toggle buttons", () => {
    render(<ProfileModeToggle value="grid" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /wide/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /strip/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grid/i })).toBeInTheDocument();
  });

  it("marks the current mode as selected (aria-pressed=true)", () => {
    render(<ProfileModeToggle value="strip" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /strip/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /wide/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /grid/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onChange with the clicked mode", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProfileModeToggle value="grid" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /strip/i }));
    expect(onChange).toHaveBeenCalledWith("strip");
  });

  it("does not call onChange when clicking the current mode", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProfileModeToggle value="grid" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /grid/i }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
