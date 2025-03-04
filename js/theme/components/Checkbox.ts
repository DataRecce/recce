import { checkboxAnatomy as parts } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/styled-system";

const { definePartsStyle, defineMultiStyleConfig } = createMultiStyleConfigHelpers(parts.keys);

// Defining a custom variant
const variantCircular = definePartsStyle({
  control: defineStyle({
    rounded: "full",
  }),
});

const variants = {
  circular: variantCircular,
};

const sizes = {
  xs: definePartsStyle({
    icon: defineStyle({
      fontSize: "8px",
    }),
    control: defineStyle({
      boxSize: "16px",
      padding: "4px",
    }),
    label: defineStyle({
      fontSize: "xs",
    }),
  }),
};

export const checkboxTheme = defineMultiStyleConfig({
  variants,
  sizes,
});
