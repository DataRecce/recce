import { checkboxAnatomy, checkboxAnatomy as parts } from "@chakra-ui/anatomy";
import { defineSlotRecipe } from "@chakra-ui/react";
import { checkmarkRecipe } from "@chakra-ui/react/theme";
import {
  createMultiStyleConfigHelpers,
  defineStyle,
} from "@chakra-ui/styled-system";

const helpers = createMultiStyleConfigHelpers(parts.keys);
const definePartsStyle = helpers.definePartsStyle.bind(helpers);
const defineMultiStyleConfig = helpers.defineMultiStyleConfig.bind(helpers);

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

export const checkboxSlotRecipe = defineSlotRecipe({
  slots: checkboxAnatomy.keys,
  className: "chakra-checkbox",
  base: {
    // root: {
    //   display: "inline-flex",
    //   gap: "2",
    //   alignItems: "center",
    //   verticalAlign: "top",
    //   position: "relative",
    // },

    control: checkmarkRecipe.base,

    label: {
      fontWeight: "medium",
      userSelect: "none",
      _disabled: {
        opacity: "0.5",
      },
    },
  },

  variants: {
    size: {
      xs: {
        root: { gap: "1.5" },
        label: { textStyle: "xs" },
        control: checkmarkRecipe.variants?.size.xs,
      },
      sm: {
        root: { gap: "2" },
        label: { textStyle: "sm" },
        control: checkmarkRecipe.variants?.size.sm,
      },
      md: {
        root: { gap: "2.5" },
        label: { textStyle: "sm" },
        control: checkmarkRecipe.variants?.size.md,
      },
      lg: {
        root: { gap: "3" },
        label: { textStyle: "md" },
        control: checkmarkRecipe.variants?.size.lg,
      },
    },

    variant: {
      outline: {
        control: checkmarkRecipe.variants?.variant.outline,
      },
      solid: {
        control: checkmarkRecipe.variants?.variant.solid,
      },
      subtle: {
        control: checkmarkRecipe.variants?.variant.subtle,
      },
    },
  },

  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});
