import type { TimelineEventData } from "@datarecce/ui/primitives";

/**
 * Create a timeline event fixture with sensible defaults
 */
export const createEvent = (
  overrides: Partial<TimelineEventData> = {},
): TimelineEventData => ({
  id: `event-${Math.random().toString(36).slice(2, 9)}`,
  event_type: "check_created",
  actor: {
    user_id: "user-1",
    fullname: "John Doe",
    login: "johndoe",
  },
  created_at: new Date().toISOString(),
  ...overrides,
});

/**
 * Create a comment event fixture
 */
export const createCommentEvent = (
  overrides: Partial<TimelineEventData> = {},
): TimelineEventData =>
  createEvent({
    event_type: "comment",
    content: "This looks good to me.",
    ...overrides,
  });

/**
 * Sample actor for stories
 */
export const sampleActor = {
  user_id: "user-1",
  fullname: "John Doe",
  login: "johndoe",
  avatarUrl: "https://i.pravatar.cc/150?u=johndoe",
};

/**
 * Another actor for multi-user scenarios
 */
export const otherActor = {
  user_id: "user-2",
  fullname: "Jane Smith",
  login: "janesmith",
  avatarUrl: "https://i.pravatar.cc/150?u=janesmith",
};
