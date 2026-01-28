import { MarkdownContent } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, within } from "storybook/test";

const meta: Meta<typeof MarkdownContent> = {
  title: "UI/MarkdownContent",
  component: MarkdownContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Renders GitHub-flavored Markdown content with syntax highlighting, external link confirmation, and XSS-safe rendering. Supports tables, task lists, strikethrough, autolinks, and code blocks.",
      },
    },
    layout: "padded",
  },
  argTypes: {
    content: {
      description: "The markdown content to render",
      control: "text",
    },
    fontSize: {
      description: "Font size for the rendered content",
      control: "text",
    },
    internalDomains: {
      description:
        "Additional domains to treat as internal (not showing confirmation dialog)",
      control: "object",
    },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: "800px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MarkdownContent>;

// ============================================
// Basic Formatting
// ============================================

export const BasicText: Story = {
  name: "Basic Text",
  args: {
    content: "This is a simple paragraph of text.",
  },
};

export const Headings: Story = {
  name: "Headings",
  args: {
    content: `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`,
  },
};

export const TextFormatting: Story = {
  name: "Text Formatting",
  args: {
    content: `**Bold text** and *italic text* and ***bold italic***

~~Strikethrough text~~

Inline \`code\` formatting`,
  },
};

export const Lists: Story = {
  name: "Lists",
  args: {
    content: `## Unordered List
- First item
- Second item
  - Nested item
  - Another nested item
- Third item

## Ordered List
1. First step
2. Second step
   1. Sub-step
   2. Another sub-step
3. Third step`,
  },
};

// ============================================
// Advanced Features
// ============================================

export const CodeBlocks: Story = {
  name: "Code Blocks with Syntax Highlighting",
  args: {
    content: `## Python Code
\`\`\`python
def validate_data(df):
    """Validate data quality"""
    if df.isnull().any().any():
        raise ValueError("Null values found")
    return True
\`\`\`

## SQL Code
\`\`\`sql
SELECT
    customer_id,
    COUNT(*) as order_count
FROM orders
WHERE created_at >= '2024-01-01'
GROUP BY customer_id
\`\`\`

## JavaScript
\`\`\`javascript
const checkData = (data) => {
  return data.every(item => item.isValid);
};
\`\`\``,
  },
};

export const Tables: Story = {
  name: "Tables (GFM)",
  args: {
    content: `## Data Quality Metrics

| Metric | Base | Current | Status |
|--------|------|---------|--------|
| Row Count | 1,234 | 1,250 | ✅ Pass |
| Null Values | 0 | 2 | ⚠️ Warning |
| Duplicates | 5 | 5 | ✅ Pass |
| Schema Match | Yes | Yes | ✅ Pass |`,
  },
};

export const TaskLists: Story = {
  name: "Task Lists (GFM)",
  args: {
    content: `## Validation Checklist

- [x] Schema validation
- [x] Row count check
- [ ] Data quality rules
- [ ] Performance benchmarks
- [x] Documentation updated`,
  },
};

export const Blockquotes: Story = {
  name: "Blockquotes",
  args: {
    content: `> **Note:** This check validates that all required columns are present.
>
> Make sure your data follows the expected schema before running.

Regular text continues here.`,
  },
};

// ============================================
// Links
// ============================================

export const InternalLinks: Story = {
  name: "Internal Links",
  parameters: {
    docs: {
      description: {
        story:
          "Relative links and hash links are treated as internal and don't show confirmation.",
      },
    },
  },
  args: {
    content: `[View Dashboard](/dashboard)
[Jump to section](#section)
[Relative path](./docs/guide.md)`,
  },
};

export const ExternalLinks: Story = {
  name: "External Links",
  parameters: {
    docs: {
      description: {
        story:
          "External links show an external link indicator (↗) and open in a new tab after confirmation.",
      },
    },
  },
  args: {
    content: `Check out the [documentation](https://docs.example.com) for more details.

Also see [GitHub](https://github.com) and [Stack Overflow](https://stackoverflow.com).`,
  },
};

export const MixedLinks: Story = {
  name: "Mixed Internal and External Links",
  args: {
    content: `- [Internal Dashboard](/checks)
- [External Docs](https://docs.getdbt.com)
- [Another Section](#metrics)
- [GitHub Issue](https://github.com/DataRecce/recce/issues/123)`,
  },
};

// ============================================
// Real-World Examples
// ============================================

export const CheckDescription: Story = {
  name: "Check Description Example",
  args: {
    content: `## Schema Validation Check

This check ensures that all tables have the expected schema structure.

### What it checks:
- Column names match expected schema
- Data types are correct
- No unexpected columns exist

### How to fix issues:
1. Review the schema diff below
2. Update your models if needed
3. Re-run the check

\`\`\`sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'customers'
\`\`\`

See [documentation](https://docs.example.com/schema-validation) for more details.`,
  },
};

export const CommentContent: Story = {
  name: "Comment Content Example",
  args: {
    content: `The changes look good! Here's what I verified:

- [x] Schema changes are backward compatible
- [x] Row counts match expected ranges
- [x] No new null values introduced

A few observations:
- The new \`customer_segment\` column has good coverage
- Performance is within acceptable limits

**Recommendation:** Safe to merge ✅`,
  },
};

// ============================================
// Font Size Variants
// ============================================

export const SmallFont: Story = {
  name: "Small Font",
  args: {
    content: "This content uses a smaller font size.",
    fontSize: "12px",
  },
};

export const LargeFont: Story = {
  name: "Large Font",
  args: {
    content: "This content uses a larger font size.",
    fontSize: "16px",
  },
};

// ============================================
// Interactive Tests
// ============================================

export const ExternalLinkConfirmation: Story = {
  name: "External Link Confirmation Test",
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates the external link confirmation dialog when clicking an external link.",
      },
    },
  },
  args: {
    content: "Visit [GitHub](https://github.com) for more information.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find and click the external link
    const link = canvas.getByRole("link", { name: /GitHub ↗/ });
    await userEvent.click(link);

    // Verify confirmation dialog appears (use screen for portal content)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(
      screen.getByText(/You are about to visit an external site/),
    ).toBeInTheDocument();
  },
};

// ============================================
// Edge Cases
// ============================================

export const EmptyContent: Story = {
  name: "Empty Content",
  args: {
    content: "",
  },
};

export const LongContent: Story = {
  name: "Long Content",
  args: {
    content: `# Comprehensive Data Validation Report

## Executive Summary
This report provides a detailed analysis of data quality checks performed on the analytics database.

## Methodology
We employed multiple validation strategies:
1. Schema validation
2. Data quality rules
3. Statistical analysis
4. Historical comparison

## Results

### Schema Validation
All tables conform to expected schema:

| Table | Columns | Status |
|-------|---------|--------|
| customers | 15 | ✅ Pass |
| orders | 22 | ✅ Pass |
| products | 18 | ✅ Pass |

### Data Quality
- **Null values**: Within acceptable thresholds
- **Duplicates**: None found
- **Outliers**: 3 records flagged for review

### Code Analysis
\`\`\`python
def analyze_quality(df):
    metrics = {
        'completeness': calculate_completeness(df),
        'validity': check_validity(df),
        'consistency': verify_consistency(df)
    }
    return metrics
\`\`\`

## Recommendations
1. Monitor flagged records
2. Update validation rules quarterly
3. Schedule regular audits

For more information, see the [full documentation](https://docs.example.com).`,
  },
};

export const SpecialCharacters: Story = {
  name: "Special Characters",
  args: {
    content: `Special characters: < > & " '

Emoji: ✅ ⚠️ ❌ 🎉

Math symbols: ± × ÷ ≈ ≠

Arrows: → ← ↑ ↓ ↗ ↘`,
  },
};
