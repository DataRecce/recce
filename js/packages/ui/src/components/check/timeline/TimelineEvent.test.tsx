/**
 * @file TimelineEvent.test.tsx
 * @description Tests for TimelineEvent component
 *
 * Tests verify:
 * - Renders different event types correctly
 * - Shows actor name and timestamp
 * - Comment events show content
 * - Deleted comments show placeholder
 * - Edit/delete buttons shown for author
 */

import { vi } from "vitest";

// Mock useIsDark hook
vi.mock("../../../hooks/useIsDark", () => ({
  useIsDark: () => false,
}));

// Mock date-fns to return predictable relative times
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "5 minutes ago",
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TimelineEventData } from "./TimelineEvent";
import { TimelineEvent } from "./TimelineEvent";

const createEvent = (
  overrides: Partial<TimelineEventData> = {},
): TimelineEventData => ({
  id: "event-1",
  event_type: "check_created",
  actor: {
    user_id: "user-1",
    fullname: "John Doe",
    login: "johndoe",
  },
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("TimelineEvent", () => {
  describe("state change events", () => {
    it("renders check_created event", () => {
      render(
        <TimelineEvent event={createEvent({ event_type: "check_created" })} />,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("created this check")).toBeInTheDocument();
      expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    });

    it("renders approval_change event (approved)", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "approval_change",
            new_value: "true",
          })}
        />,
      );

      expect(screen.getByText("approved this check")).toBeInTheDocument();
    });

    it("renders approval_change event (unapproved)", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "approval_change",
            new_value: "false",
          })}
        />,
      );

      expect(screen.getByText("unapproved this check")).toBeInTheDocument();
    });

    it("renders description_change event", () => {
      render(
        <TimelineEvent
          event={createEvent({ event_type: "description_change" })}
        />,
      );

      expect(screen.getByText("updated the description")).toBeInTheDocument();
    });

    it("renders name_change event", () => {
      render(
        <TimelineEvent event={createEvent({ event_type: "name_change" })} />,
      );

      expect(screen.getByText("renamed this check")).toBeInTheDocument();
    });

    it("renders preset_applied event", () => {
      render(
        <TimelineEvent event={createEvent({ event_type: "preset_applied" })} />,
      );

      expect(screen.getByText("applied a preset")).toBeInTheDocument();
    });

    it("uses login when fullname is not available", () => {
      render(
        <TimelineEvent
          event={createEvent({
            actor: { user_id: "user-1", login: "johndoe" },
          })}
        />,
      );

      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });

    it('falls back to "Someone" when no name available', () => {
      render(
        <TimelineEvent
          event={createEvent({
            actor: { user_id: "user-1" },
          })}
        />,
      );

      expect(screen.getByText("Someone")).toBeInTheDocument();
    });
  });

  describe("comment events", () => {
    it("renders comment content", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "This is a test comment",
          })}
        />,
      );

      expect(screen.getByText("This is a test comment")).toBeInTheDocument();
    });

    it("shows (edited) indicator for edited comments", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "Edited comment",
            is_edited: true,
          })}
        />,
      );

      expect(screen.getByText("(edited)")).toBeInTheDocument();
    });

    it("shows deleted placeholder for deleted comments", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            is_deleted: true,
          })}
        />,
      );

      expect(screen.getByText("Comment deleted")).toBeInTheDocument();
    });

    it("shows (Author) label for current user comments", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
          currentUserId="user-1"
        />,
      );

      expect(screen.getByText("(Author)")).toBeInTheDocument();
    });

    it("uses custom markdown renderer", () => {
      const CustomRenderer = ({ content }: { content: string }) => (
        <div data-testid="custom-renderer">{content.toUpperCase()}</div>
      );

      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "test content",
          })}
          markdownRenderer={CustomRenderer}
        />,
      );

      expect(screen.getByTestId("custom-renderer")).toHaveTextContent(
        "TEST CONTENT",
      );
    });
  });

  describe("comment editing", () => {
    it("shows edit button for author", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
          currentUserId="user-1"
          onEdit={onEdit}
        />,
      );

      // Hover to show buttons
      const commentBox = screen.getByText("My comment").closest("div");
      if (commentBox) {
        await user.hover(commentBox);
      }

      expect(
        screen.getByRole("button", { name: /edit comment/i }),
      ).toBeInTheDocument();
    });

    it("does not show edit button for non-author", () => {
      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "Someone else comment",
            actor: { user_id: "user-2", fullname: "Jane Doe" },
          })}
          currentUserId="user-1"
          onEdit={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /edit comment/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("comment deletion", () => {
    it("shows delete button for author", async () => {
      const user = userEvent.setup();

      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
          currentUserId="user-1"
          onDelete={vi.fn()}
        />,
      );

      // Hover to show buttons
      const commentBox = screen.getByText("My comment").closest("div");
      if (commentBox) {
        await user.hover(commentBox);
      }

      expect(
        screen.getByRole("button", { name: /delete comment/i }),
      ).toBeInTheDocument();
    });

    it("shows confirmation popover on delete click", async () => {
      const user = userEvent.setup();

      render(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
          currentUserId="user-1"
          onDelete={vi.fn()}
        />,
      );

      // Click delete button
      await user.click(screen.getByRole("button", { name: /delete comment/i }));

      expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
    });

    it("calls onDelete when confirmed", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      render(
        <TimelineEvent
          event={createEvent({
            id: "event-123",
            event_type: "comment",
            content: "My comment",
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
          currentUserId="user-1"
          onDelete={onDelete}
        />,
      );

      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith("event-123");
      });
    });
  });

  describe("avatar rendering", () => {
    it("shows avatar with avatarUrl when provided", () => {
      render(
        <TimelineEvent
          event={createEvent({
            actor: {
              user_id: "user-1",
              fullname: "John Doe",
              avatarUrl: "https://example.com/avatar.png",
            },
          })}
        />,
      );

      const avatar = screen.getByRole("img");
      expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
    });

    it("shows initials when no avatarUrl", () => {
      render(
        <TimelineEvent
          event={createEvent({
            actor: { user_id: "user-1", fullname: "John Doe" },
          })}
        />,
      );

      expect(screen.getByText("J")).toBeInTheDocument();
    });
  });
});
