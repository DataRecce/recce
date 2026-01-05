/**
 * Check Events API - Types and Client Functions
 *
 * Provides timeline/conversation functionality for Checks, enabling
 * GitHub PR-style discussions with comments and automatic tracking
 * of state changes.
 *
 * NOTE: This feature is only available when connected to Recce Cloud.
 */

import type { AxiosInstance, AxiosResponse } from "axios";

// ============================================================================
// Event Types
// ============================================================================

export type CheckEventType =
  | "check_created"
  | "comment"
  | "approval_change"
  | "description_change"
  | "name_change"
  | "preset_applied";

export type ActorType = "user" | "recce_ai" | "preset_system";

// ============================================================================
// Actor Interface
// ============================================================================

export interface CheckEventActor {
  type: ActorType;
  user_id: number | null;
  login: string | null;
  fullname: string | null;
}

// ============================================================================
// Check Event Interface
// ============================================================================

export interface CheckEvent {
  id: string;
  check_id: string;
  event_type: CheckEventType;
  actor: CheckEventActor;
  content: string | null;
  old_value: string | null;
  new_value: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateCommentRequest {
  content: string;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CheckEventsListResponse {
  events: CheckEvent[];
}

// ============================================================================
// API Client Functions
// ============================================================================

/**
 * List all events for a check in chronological order.
 *
 * @param checkId - The check ID
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to array of CheckEvent objects
 */
export async function listCheckEvents(
  checkId: string,
  client: AxiosInstance,
): Promise<CheckEvent[]> {
  const response = await client.get<never, AxiosResponse<CheckEvent[]>>(
    `/api/checks/${checkId}/events`,
  );
  return response.data;
}

/**
 * Get a specific event by ID.
 *
 * @param checkId - The check ID
 * @param eventId - The event ID
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to a CheckEvent object
 */
export async function getCheckEvent(
  checkId: string,
  eventId: string,
  client: AxiosInstance,
): Promise<CheckEvent> {
  const response = await client.get<never, AxiosResponse<CheckEvent>>(
    `/api/checks/${checkId}/events/${eventId}`,
  );
  return response.data;
}

/**
 * Create a new comment on a check.
 *
 * @param checkId - The check ID
 * @param content - The comment content (plain text for now, markdown later)
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to the created CheckEvent
 */
export async function createComment(
  checkId: string,
  content: string,
  client: AxiosInstance,
): Promise<CheckEvent> {
  const response = await client.post<
    CreateCommentRequest,
    AxiosResponse<CheckEvent>
  >(`/api/checks/${checkId}/events`, { content });
  return response.data;
}

/**
 * Update an existing comment.
 * Only the author or an admin can update a comment.
 *
 * @param checkId - The check ID
 * @param eventId - The event ID of the comment to update
 * @param content - The new comment content
 * @param client - Axios instance for API configuration
 * @returns Promise resolving to the updated CheckEvent
 */
export async function updateComment(
  checkId: string,
  eventId: string,
  content: string,
  client: AxiosInstance,
): Promise<CheckEvent> {
  const response = await client.patch<
    UpdateCommentRequest,
    AxiosResponse<CheckEvent>
  >(`/api/checks/${checkId}/events/${eventId}`, { content });
  return response.data;
}

/**
 * Delete a comment (soft delete).
 * Only the author or an admin can delete a comment.
 *
 * @param checkId - The check ID
 * @param eventId - The event ID of the comment to delete
 * @param client - Axios instance for API configuration
 * @returns Promise resolving when deletion is complete
 */
export async function deleteComment(
  checkId: string,
  eventId: string,
  client: AxiosInstance,
): Promise<void> {
  await client.delete(`/api/checks/${checkId}/events/${eventId}`);
}

// ============================================================================
// Type Guards
// ============================================================================

export function isCommentEvent(event: CheckEvent): boolean {
  return event.event_type === "comment";
}

export function isStateChangeEvent(event: CheckEvent): boolean {
  return (
    event.event_type === "approval_change" ||
    event.event_type === "description_change" ||
    event.event_type === "name_change"
  );
}

export function isSystemEvent(event: CheckEvent): boolean {
  return (
    event.event_type === "check_created" ||
    event.event_type === "preset_applied"
  );
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get a human-readable description of an event for display.
 */
export function getEventDescription(event: CheckEvent): string {
  const actorName = event.actor.fullname || event.actor.login || "Someone";

  switch (event.event_type) {
    case "check_created":
      return `${actorName} created this check`;
    case "comment":
      if (event.is_deleted) {
        return "Comment deleted";
      }
      return event.content || "";
    case "approval_change":
      if (event.new_value === "true") {
        return `${actorName} approved this check`;
      }
      return `${actorName} unapproved this check`;
    case "description_change":
      return `${actorName} updated the description`;
    case "name_change":
      return `${actorName} renamed this check`;
    case "preset_applied":
      return `${actorName} applied a preset`;
    default:
      return `${actorName} made a change`;
  }
}

/**
 * Get the appropriate icon name for an event type.
 * Returns a string that can be used with react-icons.
 */
export function getEventIconType(
  event: CheckEvent,
): "comment" | "approve" | "unapprove" | "edit" | "create" | "preset" {
  switch (event.event_type) {
    case "check_created":
      return "create";
    case "comment":
      return "comment";
    case "approval_change":
      return event.new_value === "true" ? "approve" : "unapprove";
    case "description_change":
    case "name_change":
      return "edit";
    case "preset_applied":
      return "preset";
    default:
      return "edit";
  }
}
