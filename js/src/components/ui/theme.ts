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
          50: { value: "#FFDED5" },
          100: { value: "#FFC1B0" },
          200: { value: "#FFA58C" },
          300: { value: "#FF8967" },
          400: { value: "#FF6E42" },
          DEFAULT: { value: "#FD541E" },
          500: { value: "#FD541E" },
          600: { value: "#F04104" },
          700: { value: "#C93A06" },
          800: { value: "#A23206" },
          900: { value: "#7C2906" },
          950: { value: "#571E05" },
        },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.white}" },
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
