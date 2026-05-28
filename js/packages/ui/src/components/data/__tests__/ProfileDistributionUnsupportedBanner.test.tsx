/**
 * @file ProfileDistributionUnsupportedBanner.test.tsx
 * @description Tests for the once-per-task unsupported-adapter banner (DRC-3390 PR 3).
 */

import { render } from "@testing-library/react";
import { ProfileDistributionUnsupportedBanner } from "../ProfileDistributionUnsupportedBanner";

describe("ProfileDistributionUnsupportedBanner", () => {
  it("renders a generic message when no reason is supplied", () => {
    const { getByTestId, getByText } = render(
      <ProfileDistributionUnsupportedBanner />,
    );
    expect(
      getByTestId("profile-distribution-unsupported-banner"),
    ).toBeInTheDocument();
    expect(
      getByText(/paired column distributions aren't available here/i),
    ).toBeInTheDocument();
  });

  it("renders the backend reason verbatim when provided", () => {
    const { getByText } = render(
      <ProfileDistributionUnsupportedBanner reason="this dialect lacks APPROX_PERCENTILE" />,
    );
    expect(
      getByText("this dialect lacks APPROX_PERCENTILE"),
    ).toBeInTheDocument();
  });

  it("renders the adapter-type in the title when provided", () => {
    const { getByText } = render(
      <ProfileDistributionUnsupportedBanner adapterType="postgres" />,
    );
    expect(getByText(/postgres/i)).toBeInTheDocument();
  });

  it("uses role=status for screen readers (non-disruptive)", () => {
    const { getByRole } = render(<ProfileDistributionUnsupportedBanner />);
    expect(getByRole("status")).toBeInTheDocument();
  });
});
