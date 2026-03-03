import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { RecceFeatureToggles } from "../../../contexts/instance";
import {
  SetupConnectionBanner,
  type SetupConnectionBannerProps,
} from "../SetupConnectionBanner";

describe("SetupConnectionBanner", () => {
  const defaultFeatureToggles: RecceFeatureToggles = {
    mode: "metadata only",
    disableSaveToFile: false,
    disableExportStateFile: false,
    disableImportStateFile: false,
    disableUpdateChecklist: false,
    disableDatabaseQuery: true,
    disableViewActionDropdown: false,
    disableNodeActionDropdown: false,
    disableShare: false,
  };

  const defaultProps: SetupConnectionBannerProps = {
    featureToggles: defaultFeatureToggles,
    settingsUrl: "https://example.com/settings",
  };

  const renderComponent = (props: Partial<SetupConnectionBannerProps> = {}) => {
    return render(<SetupConnectionBanner {...defaultProps} {...props} />);
  };

  describe("rendering", () => {
    it("renders banner when mode is 'metadata only'", () => {
      renderComponent();

      expect(
        screen.getByText(
          "Query functions disabled without a data warehouse connection.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /connect to data warehouse/i }),
      ).toBeInTheDocument();
    });

    it("returns null when mode is not 'metadata only'", () => {
      const { container } = renderComponent({
        featureToggles: {
          ...defaultFeatureToggles,
          mode: null, // null means full functionality enabled
        },
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("interactions", () => {
    it("opens settings URL in new tab when button is clicked", async () => {
      const user = userEvent.setup();
      const mockOpen = vi.fn();
      const originalOpen = window.open;
      window.open = mockOpen;

      renderComponent({
        settingsUrl: "https://test.example.com/settings",
      });

      const button = screen.getByRole("button", {
        name: /connect to data warehouse/i,
      });
      await user.click(button);

      expect(mockOpen).toHaveBeenCalledWith(
        "https://test.example.com/settings",
        "_blank",
      );

      window.open = originalOpen;
    });
  });

  describe("feature toggles modes", () => {
    const modeTestCases: Array<{
      mode: RecceFeatureToggles["mode"];
      shouldRender: boolean;
    }> = [
      { mode: "metadata only", shouldRender: true },
      { mode: null, shouldRender: false }, // null means full functionality
      { mode: "read only", shouldRender: false },
    ];

    it.each(modeTestCases)("renders=$shouldRender when mode is '$mode'", ({
      mode,
      shouldRender,
    }) => {
      const { container } = renderComponent({
        featureToggles: {
          ...defaultFeatureToggles,
          mode,
        },
      });

      if (shouldRender) {
        expect(
          screen.getByText(
            "Query functions disabled without a data warehouse connection.",
          ),
        ).toBeInTheDocument();
      } else {
        expect(container).toBeEmptyDOMElement();
      }
    });
  });
});
