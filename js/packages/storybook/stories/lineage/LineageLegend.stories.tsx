import { LineageLegend } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * @file LineageLegend.stories.tsx
 * @description Stories for the LineageLegend component showing change status
 * and transformation type legends, including the new "Impacted" status.
 */

const meta: Meta<typeof LineageLegend> = {
  title: "Lineage/LineageLegend",
  component: LineageLegend,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof LineageLegend>;

/**
 * Default change status legend (OSS lineage view).
 * Tailwind palette, no "Impacted" entry.
 */
export const ChangeStatus: Story = {
  args: {
    variant: "changeStatus",
    title: "Changes",
    showTooltips: true,
  },
};

/**
 * Change status legend inside the new CLL experience.
 * Muted brown/yellow palette, includes "Impacted", and documents the ADD /
 * COLUMN graph badges the canvas nodes carry.
 */
export const ChangeStatusCll: Story = {
  args: {
    variant: "changeStatus",
    title: "Changes",
    showTooltips: true,
    newCllExperience: true,
  },
};

/**
 * Same legend in dark mode — the badge swatches take their tokens from
 * `useIsDark()`, so this is where a light/dark token regression shows up.
 */
export const ChangeStatusCllDark: Story = {
  args: {
    variant: "changeStatus",
    title: "Changes",
    showTooltips: true,
    newCllExperience: true,
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
  globals: {
    theme: "dark",
  },
};

/**
 * Transformation type legend showing column transformation types.
 */
export const Transformation: Story = {
  args: {
    variant: "transformation",
    title: "Column transformations",
    showTooltips: true,
  },
};

/**
 * A displayed chain containing only passthrough and derived columns.
 */
export const FilteredTransformation: Story = {
  args: {
    variant: "transformation",
    title: "Column transformations",
    transformationTypes: ["passthrough", "derived"],
    showTooltips: true,
  },
};

/**
 * Change status legend without title.
 */
export const ChangeStatusNoTitle: Story = {
  args: {
    variant: "changeStatus",
    showTooltips: true,
  },
};
