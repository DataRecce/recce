import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./TimelineEvent.stories";

const composedStories = composeStories(stories);
const {
  CheckCreated,
  Approved,
  Unapproved,
  DescriptionChanged,
  NameChanged,
  PresetApplied,
  Comment,
  CommentEdited,
  CommentDeleted,
  CommentWithActions,
  CommentFromOtherUser,
  ActorWithoutFullname,
  ActorWithoutName,
} = composedStories;

describe("TimelineEvent", () => {
  describe("state change events", () => {
    it("renders check created event", () => {
      render(<CheckCreated />);
      expect(screen.getByText("created this check")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    it("renders approved event", () => {
      render(<Approved />);
      expect(screen.getByText("approved this check")).toBeInTheDocument();
    });

    it("renders unapproved event", () => {
      render(<Unapproved />);
      expect(screen.getByText("unapproved this check")).toBeInTheDocument();
    });

    it("renders description changed event", () => {
      render(<DescriptionChanged />);
      expect(screen.getByText("updated the description")).toBeInTheDocument();
    });

    it("renders name changed event", () => {
      render(<NameChanged />);
      expect(screen.getByText("renamed this check")).toBeInTheDocument();
    });

    it("renders preset applied event", () => {
      render(<PresetApplied />);
      expect(screen.getByText("applied a preset")).toBeInTheDocument();
    });
  });

  describe("comment events", () => {
    it("renders comment content", () => {
      render(<Comment />);
      expect(screen.getByText(/This looks good to me/)).toBeInTheDocument();
    });

    it("shows edited indicator", () => {
      render(<CommentEdited />);
      expect(screen.getByText("(edited)")).toBeInTheDocument();
    });

    it("shows deleted placeholder", () => {
      render(<CommentDeleted />);
      expect(screen.getByText("Comment deleted")).toBeInTheDocument();
    });

    it("shows author label for own comments", () => {
      render(<CommentWithActions />);
      expect(screen.getByText("(Author)")).toBeInTheDocument();
    });

    it("does not show author label for other users", () => {
      render(<CommentFromOtherUser />);
      expect(screen.queryByText("(Author)")).not.toBeInTheDocument();
    });
  });

  describe("actor fallbacks", () => {
    it("falls back to login when no fullname", () => {
      render(<ActorWithoutFullname />);
      expect(screen.getByText("johndoe")).toBeInTheDocument();
    });

    it("falls back to Someone when no name", () => {
      render(<ActorWithoutName />);
      expect(screen.getByText("Someone")).toBeInTheDocument();
    });
  });
});
