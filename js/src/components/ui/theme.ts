import { createSystem, defaultConfig } from "@chakra-ui/react";
// import { checkboxTheme } from "@theme/components/Checkbox";
// import { tooltipTheme } from "@theme/components/Tooltip";

export const system = createSystem(defaultConfig, {
  preflight: {
    scope: ".chakra-style-reset",
  },
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
          950: { value: "#fd683e" },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.brand.100}" },
          fg: { value: "{colors.brand.700}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.200}" },
          emphasized: { value: "{colors.brand.300}" },
          focusRing: { value: "{colors.brand.500}" },
        },
      },
    },
  },
});
