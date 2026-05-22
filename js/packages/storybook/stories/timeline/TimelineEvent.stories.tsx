import { TimelineEvent } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
  createCommentEvent,
  createEvent,
  otherActor,
  sampleActor,
} from "./fixtures";

const meta: Meta<typeof TimelineEvent> = {
  title: "Checks/TimelineEvent",
  component: TimelineEvent,
  argTypes: {
    event: {
      description: "The event data to render",
      control: "object",
    },
    currentUserId: {
      description: "Current user ID (enables edit/delete for own comments)",
      control: "text",
    },
    onEdit: {
      description: "Callback when editing a comment",
      action: "edited",
    },
    onDelete: {
      description: "Callback when deleting a comment",
      action: "deleted",
    },
    markdownRenderer: {
      description: "Optional custom markdown renderer component",
      control: false,
    },
    className: {
      description: "Optional CSS class name",
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TimelineEvent>;

// State-change events covered by visual.ts

export const CheckCreated: Story = {
  args: {
    event: createEvent({
      event_type: "check_created",
      actor: sampleActor,
    }),
  },
};

export const Approved: Story = {
  args: {
    event: createEvent({
      event_type: "approval_change",
      new_value: "true",
      actor: sampleActor,
    }),
  },
};

export const Unapproved: Story = {
  args: {
    event: createEvent({
      event_type: "approval_change",
      new_value: "false",
      actor: sampleActor,
    }),
  },
};

// Other state-change events (consumed by TimelineEvent.test.tsx)

export const DescriptionChanged: Story = {
  args: {
    event: createEvent({
      event_type: "description_change",
      actor: sampleActor,
    }),
  },
};

export const NameChanged: Story = {
  args: {
    event: createEvent({
      event_type: "name_change",
      actor: sampleActor,
    }),
  },
};

export const PresetApplied: Story = {
  args: {
    event: createEvent({
      event_type: "preset_applied",
      actor: sampleActor,
    }),
  },
};

// Comment events covered by visual.ts

export const Comment: Story = {
  args: {
    event: createCommentEvent({
      content:
        "This looks good to me. The changes align with our data quality standards and the test coverage is comprehensive.",
      actor: sampleActor,
    }),
  },
};

export const CommentEdited: Story = {
  args: {
    event: createCommentEvent({
      content: "Updated comment content after editing.",
      is_edited: true,
      actor: sampleActor,
    }),
  },
};

export const CommentDeleted: Story = {
  args: {
    event: createCommentEvent({
      is_deleted: true,
      actor: sampleActor,
    }),
  },
};

export const CommentFromOtherUser: Story = {
  args: {
    event: createCommentEvent({
      content: "A comment from another team member.",
      actor: otherActor,
    }),
    currentUserId: "user-1",
    onEdit: fn(),
    onDelete: fn(),
  },
};

// Actor fallbacks (consumed by TimelineEvent.test.tsx)

export const ActorWithoutFullname: Story = {
  args: {
    event: createEvent({
      actor: { user_id: "user-1", login: "johndoe" },
    }),
  },
};

export const ActorWithoutName: Story = {
  args: {
    event: createEvent({
      actor: { user_id: "user-1" },
    }),
  },
};

export const CommentWithActions: Story = {
  args: {
    event: createCommentEvent({
      content: "My own comment that I can edit or delete.",
      actor: sampleActor,
    }),
    currentUserId: "user-1",
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const comment = canvas.getByText(
      "My own comment that I can edit or delete.",
    );
    await userEvent.hover(comment);
    const editButton = canvas.getByRole("button", { name: /edit comment/i });
    expect(editButton).toBeInTheDocument();
    const deleteButton = canvas.getByRole("button", {
      name: /delete comment/i,
    });
    expect(deleteButton).toBeInTheDocument();
  },
};

// Interaction tests

export const CommentEditInteraction: Story = {
  args: {
    event: createCommentEvent({
      content: "Click edit to modify this comment.",
      actor: sampleActor,
    }),
    currentUserId: "user-1",
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const comment = canvas.getByText("Click edit to modify this comment.");
    await userEvent.hover(comment);
    const editButton = canvas.getByRole("button", { name: /edit comment/i });
    await userEvent.click(editButton);
    const textarea = canvas.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Click edit to modify this comment.");
    expect(canvas.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(canvas.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  },
};

export const CommentDeleteConfirmation: Story = {
  args: {
    event: createCommentEvent({
      content: "Click delete to see confirmation dialog.",
      actor: sampleActor,
    }),
    currentUserId: "user-1",
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const comment = canvas.getByText(
      "Click delete to see confirmation dialog.",
    );
    await userEvent.hover(comment);
    const deleteButton = canvas.getByRole("button", {
      name: /delete comment/i,
    });
    await userEvent.click(deleteButton);
    expect(screen.getByText("Delete this comment?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^delete$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  },
};
