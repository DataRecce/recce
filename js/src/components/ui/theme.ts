import { createSystem, defaultConfig } from "@chakra-ui/react";
// import { checkboxTheme } from "@theme/components/Checkbox";
// import { tooltipTheme } from "@theme/components/Tooltip";

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        brand: {
          100: { value: "#fd683e" },
          200: { value: "#fd683e" },
          300: { value: "#fd683e" },
          400: { value: "#fd683e" },
          500: { value: "#fd683e" },
          600: { value: "#fd683e" },
          700: { value: "#fd683e" },
          800: { value: "#fd683e" },
          900: { value: "#fd683e" },
        },
      },
    },
  },
});
