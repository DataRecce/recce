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
 * Muted brown/yellow palette, includes "Impacted".
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
 * Transformation type legend showing column transformation types.
 */
export const Transformation: Story = {
  args: {
    variant: "transformation",
    title: "Transformations",
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
