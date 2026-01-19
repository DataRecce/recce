/**
 * @file TimelineEvent.test.tsx
 * @description Tests for OSS TimelineEvent component
 *
 * Documents current behavior before migration to @datarecce/ui:
 * - Renders different event types
 * - Shows actor name and timestamp
 * - Comment events show content
 * - Deleted comments show placeholder
 * - Edit/delete buttons shown for author
 * - Fetches avatar via React Query (OSS-specific)
 */

import type { CheckEvent } from "@datarecce/ui/api";
import { TimelineEventOss as TimelineEvent } from "@datarecce/ui/components/check/timeline/TimelineEventOss";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

// Mock useIsDark hook
vi.mock("@datarecce/ui/hooks/useIsDark", () => ({
  useIsDark: () => false,
}));

// Mock date-fns to return predictable relative times
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "5 minutes ago",
}));

// Mock avatar fetching
vi.mock("@datarecce/ui/lib/api/user", () => ({
  fetchGitHubAvatar: vi.fn().mockResolvedValue(null),
}));

// Mock MarkdownContent from @datarecce/ui/primitives
vi.mock("@datarecce/ui/primitives", () => ({
  MarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown-content">{content}</div>
  ),
}));

const createEvent = (overrides: Partial<CheckEvent> = {}): CheckEvent => ({
  id: "event-1",
  check_id: "check-1",
  event_type: "check_created",
  actor: {
    type: "user",
    user_id: 1,
    fullname: "John Doe",
    login: "johndoe",
  },
  content: null,
  old_value: null,
  new_value: null,
  is_edited: false,
  is_deleted: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("TimelineEvent", () => {
  describe("state change events", () => {
    it("renders check_created event", () => {
      renderWithQueryClient(
        <TimelineEvent event={createEvent({ event_type: "check_created" })} />,
      );

      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("created this check")).toBeInTheDocument();
      expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    });

    it("renders approval_change event (approved)", () => {
      renderWithQueryClient(
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
      renderWithQueryClient(
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
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({ event_type: "description_change" })}
        />,
      );

      expect(screen.getByText("updated the description")).toBeInTheDocument();
    });

    it("renders name_change event", () => {
      renderWithQueryClient(
        <TimelineEvent event={createEvent({ event_type: "name_change" })} />,
      );

      expect(screen.getByText("renamed this check")).toBeInTheDocument();
    });

    it("renders preset_applied event", () => {
      renderWithQueryClient(
        <TimelineEvent event={createEvent({ event_type: "preset_applied" })} />,
      );

      expect(screen.getByText("applied a preset")).toBeInTheDocument();
    });

    it("uses login when fullname is not available", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            actor: {
              type: "user",
              user_id: 1,
              login: "johndoe",
              fullname: null,
            },
          })}
        />,
      );

      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });

    it('falls back to "Someone" when no name available', () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            actor: { type: "user", user_id: 1, login: null, fullname: null },
          })}
        />,
      );

      expect(screen.getByText("Someone")).toBeInTheDocument();
    });
  });

  describe("comment events", () => {
    it("renders comment content", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "This is a test comment",
          })}
        />,
      );

      expect(screen.getByTestId("markdown-content")).toHaveTextContent(
        "This is a test comment",
      );
    });

    it("shows (edited) indicator for edited comments", () => {
      renderWithQueryClient(
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
      renderWithQueryClient(
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
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
        />,
      );

      expect(screen.getByText("(Author)")).toBeInTheDocument();
    });

    it("does not show (Author) label for other users", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "Other comment",
            actor: {
              type: "user",
              user_id: 2,
              fullname: "Jane Doe",
              login: null,
            },
          })}
          currentUserId="1"
        />,
      );

      expect(screen.queryByText("(Author)")).not.toBeInTheDocument();
    });
  });

  describe("comment editing", () => {
    it("shows edit button for author on hover", () => {
      const onEdit = vi.fn();

      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onEdit={onEdit}
        />,
      );

      // The button should exist (opacity is controlled by CSS on hover)
      expect(
        screen.getByRole("button", { name: /edit comment/i }),
      ).toBeInTheDocument();
    });

    it("does not show edit button for non-author", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "Someone else comment",
            actor: {
              type: "user",
              user_id: 2,
              fullname: "Jane Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onEdit={vi.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /edit comment/i }),
      ).not.toBeInTheDocument();
    });

    it("does not show edit button when onEdit not provided", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
        />,
      );

      expect(
        screen.queryByRole("button", { name: /edit comment/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("comment deletion", () => {
    it("shows delete button for author", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onDelete={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: /delete comment/i }),
      ).toBeInTheDocument();
    });

    it("shows confirmation popover on delete click", async () => {
      const user = userEvent.setup();

      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /delete comment/i }));

      expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
    });

    it("calls onDelete when confirmed", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn().mockResolvedValue(undefined);

      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            id: "event-123",
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onDelete={onDelete}
        />,
      );

      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith("event-123");
      });
    });

    it("closes popover on cancel", async () => {
      const user = userEvent.setup();

      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            event_type: "comment",
            content: "My comment",
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
          currentUserId="1"
          onDelete={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: /delete comment/i }));
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));

      await waitFor(() => {
        expect(
          screen.queryByText("Delete this comment?"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("avatar rendering", () => {
    it("shows avatar initials when no avatar URL", () => {
      renderWithQueryClient(
        <TimelineEvent
          event={createEvent({
            actor: {
              type: "user",
              user_id: 1,
              fullname: "John Doe",
              login: null,
            },
          })}
        />,
      );

      // Avatar shows initials (J for John)
      expect(screen.getByText("J")).toBeInTheDocument();
    });
  });
});
