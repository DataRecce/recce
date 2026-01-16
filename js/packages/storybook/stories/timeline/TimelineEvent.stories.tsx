import { TimelineEvent } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import {
  createCommentEvent,
  createEvent,
  otherActor,
  sampleActor,
} from "./fixtures";

const meta: Meta<typeof TimelineEvent> = {
  title: "Timeline/TimelineEvent",
  component: TimelineEvent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Renders timeline events including comments, approvals, and state changes. Supports different event types with appropriate icons and styling.",
      },
    },
  },
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

// ============================================
// State Change Events
// ============================================

export const CheckCreated: Story = {
  name: "Check Created",
  args: {
    event: createEvent({
      event_type: "check_created",
      actor: sampleActor,
    }),
  },
};

export const Approved: Story = {
  name: "Approved",
  args: {
    event: createEvent({
      event_type: "approval_change",
      new_value: "true",
      actor: sampleActor,
    }),
  },
};

export const Unapproved: Story = {
  name: "Unapproved",
  args: {
    event: createEvent({
      event_type: "approval_change",
      new_value: "false",
      actor: sampleActor,
    }),
  },
};

export const DescriptionChanged: Story = {
  name: "Description Changed",
  args: {
    event: createEvent({
      event_type: "description_change",
      actor: sampleActor,
    }),
  },
};

export const NameChanged: Story = {
  name: "Name Changed",
  args: {
    event: createEvent({
      event_type: "name_change",
      actor: sampleActor,
    }),
  },
};

export const PresetApplied: Story = {
  name: "Preset Applied",
  args: {
    event: createEvent({
      event_type: "preset_applied",
      actor: sampleActor,
    }),
  },
};

// ============================================
// Comment Events
// ============================================

export const Comment: Story = {
  name: "Comment",
  args: {
    event: createCommentEvent({
      content:
        "This looks good to me. The changes align with our data quality standards and the test coverage is comprehensive.",
      actor: sampleActor,
    }),
  },
};

export const CommentEdited: Story = {
  name: "Comment (Edited)",
  args: {
    event: createCommentEvent({
      content: "Updated comment content after editing.",
      is_edited: true,
      actor: sampleActor,
    }),
  },
};

export const CommentDeleted: Story = {
  name: "Comment (Deleted)",
  args: {
    event: createCommentEvent({
      is_deleted: true,
      actor: sampleActor,
    }),
  },
};

export const CommentWithActions: Story = {
  name: "Comment with Actions",
  parameters: {
    docs: {
      description: {
        story:
          "When the current user is the comment author, edit and delete buttons appear on hover.",
      },
    },
  },
  args: {
    event: createCommentEvent({
      content: "My own comment that I can edit or delete.",
      actor: sampleActor,
    }),
    currentUserId: "user-1",
    onEdit: fn(),
    onDelete: fn(),
  },
};

export const CommentFromOtherUser: Story = {
  name: "Comment from Other User",
  parameters: {
    docs: {
      description: {
        story:
          "Comments from other users do not show edit/delete buttons even if callbacks are provided.",
      },
    },
  },
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

export const LongComment: Story = {
  name: "Long Comment",
  args: {
    event: createCommentEvent({
      content: `This is a longer comment that spans multiple lines to demonstrate how the component handles extended content.

Key observations:
- The data quality checks passed
- Schema changes are backward compatible
- Performance metrics look good

I recommend proceeding with the merge after addressing the minor formatting issues mentioned in the inline comments.`,
      actor: sampleActor,
    }),
  },
};

// ============================================
// Edge Cases
// ============================================

export const ActorWithoutFullname: Story = {
  name: "Actor Without Fullname",
  parameters: {
    docs: {
      description: {
        story: "Falls back to login when fullname is not available.",
      },
    },
  },
  args: {
    event: createEvent({
      actor: { user_id: "user-1", login: "johndoe" },
    }),
  },
};

export const ActorWithoutName: Story = {
  name: "Actor Without Name",
  parameters: {
    docs: {
      description: {
        story:
          'Falls back to "Someone" when neither fullname nor login is available.',
      },
    },
  },
  args: {
    event: createEvent({
      actor: { user_id: "user-1" },
    }),
  },
};

export const ActorWithAvatar: Story = {
  name: "Actor With Avatar",
  args: {
    event: createEvent({
      actor: sampleActor,
    }),
  },
};

export const ActorWithoutAvatar: Story = {
  name: "Actor Without Avatar",
  parameters: {
    docs: {
      description: {
        story: "Shows initials when avatar URL is not provided.",
      },
    },
  },
  args: {
    event: createEvent({
      actor: {
        user_id: "user-1",
        fullname: "John Doe",
        login: "johndoe",
      },
    }),
  },
};
