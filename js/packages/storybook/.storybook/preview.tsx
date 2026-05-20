import { theme } from "@datarecce/ui/theme";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import type { Preview } from "@storybook/react-vite";
import "chartjs-adapter-date-fns";
import { useEffect } from "react";

// Import styles from @datarecce/ui
import "@datarecce/ui/styles";

// Initialize MSW for API mocking
import { worker } from "./mocks/browser";

if (typeof window !== "undefined") {
  worker.start({
    onUnhandledRequest: "bypass", // Don't warn on unhandled requests
    quiet: true, // Reduce console noise
  });
}

// The @datarecce/ui theme uses CSS-variables mode with `colorSchemeSelector:
// "class"`, so a single theme drives both light and dark modes — the global
// decorator below toggles the `.dark` class on <html>.

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
  },
  initialGlobals: {
    theme: "light",
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme for components",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.theme === "dark";

      // Manually manage .dark class on document element for useIsDark() hook
      // and for the CSS-variables theme's class-based color scheme selector.
      useEffect(() => {
        document.documentElement.classList.toggle("dark", isDark);
      }, [isDark]);

      return (
        <MuiThemeProvider theme={theme}>
          <CssBaseline />
          <Story />
        </MuiThemeProvider>
      );
    },
  ],
};

export default preview;
