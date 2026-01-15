/**
 * Tooltip messages for disabled UI elements.
 * Used across lineage and check components to explain why actions are unavailable.
 */
export const DisableTooltipMessages = {
  add_or_remove: "Unavailable for added or removed resources.",
} as const;

export type DisableTooltipMessageKey = keyof typeof DisableTooltipMessages;
