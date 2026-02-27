import type { Decorator } from "@storybook/react-vite";

/**
 * Fullscreen decorator for result view stories.
 * Provides a full viewport container with padding.
 */
export const fullscreenDecorator: Decorator = (Story) => (
  <div
    style={{
      height: "100vh",
      minHeight: "600px",
      width: "100%",
      padding: "20px",
    }}
  >
    <Story />
  </div>
);
