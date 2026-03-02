import { DiffEditor } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof DiffEditor> = {
  title: "Editor/DiffEditor",
  component: DiffEditor,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A read-only diff viewer using CodeMirror's merge view. Supports SQL and YAML syntax highlighting with side-by-side or unified (inline) diff modes.",
      },
    },
    layout: "padded",
  },
  argTypes: {
    original: { description: "Base/original text content" },
    modified: { description: "Modified/current text content" },
    language: {
      description: "Syntax highlighting language",
      control: "select",
      options: ["sql", "yaml", "text"],
    },
    sideBySide: {
      description: "Side-by-side (true) or unified inline (false) view",
    },
    theme: {
      description: "Color theme",
      control: "select",
      options: ["light", "dark"],
    },
    height: { description: "Editor height (CSS value)" },
  },
};

export default meta;
type Story = StoryObj<typeof DiffEditor>;

const baseSql = `SELECT
  customer_id,
  first_name,
  last_name,
  email
FROM customers
WHERE status = 'active'`;

const modifiedSql = `SELECT
  customer_id,
  first_name,
  last_name,
  email,
  created_at
FROM customers
WHERE status = 'active'
  AND country = 'US'`;

export const SqlDiff: Story = {
  name: "SQL Diff (Default)",
  args: {
    original: baseSql,
    modified: modifiedSql,
    language: "sql",
    sideBySide: true,
    height: "300px",
  },
};

export const UnifiedView: Story = {
  name: "Unified (Inline) View",
  parameters: {
    docs: {
      description: {
        story:
          "Inline diff mode shows changes in a single column with deletions and additions clearly marked.",
      },
    },
  },
  args: {
    original: baseSql,
    modified: modifiedSql,
    language: "sql",
    sideBySide: false,
    height: "350px",
  },
};

const baseYaml = `version: 2
models:
  - name: customers
    columns:
      - name: customer_id
        tests:
          - unique`;

const modifiedYaml = `version: 2
models:
  - name: customers
    description: Customer dimension table
    columns:
      - name: customer_id
        tests:
          - unique
          - not_null`;

export const YamlDiff: Story = {
  name: "YAML Diff",
  args: {
    original: baseYaml,
    modified: modifiedYaml,
    language: "yaml",
    sideBySide: true,
    height: "280px",
  },
};

// Long SQL to demonstrate collapsed unchanged regions
const longOriginal = `-- Revenue attribution model
-- Attributes revenue to marketing channels using multi-touch logic

WITH raw_events AS (
  SELECT
    event_id,
    user_id,
    session_id,
    event_type,
    channel,
    campaign_id,
    event_timestamp,
    page_url,
    referrer_url
  FROM {{ ref('stg_events') }}
  WHERE event_timestamp >= DATEADD('day', -90, CURRENT_DATE)
),

sessions AS (
  SELECT
    session_id,
    user_id,
    MIN(event_timestamp) AS session_start,
    MAX(event_timestamp) AS session_end,
    COUNT(*) AS event_count,
    MIN_BY(channel, event_timestamp) AS entry_channel,
    MIN_BY(campaign_id, event_timestamp) AS entry_campaign,
    MAX_BY(page_url, event_timestamp) AS exit_page
  FROM raw_events
  GROUP BY session_id, user_id
),

conversions AS (
  SELECT
    e.user_id,
    e.session_id,
    e.event_id AS conversion_event_id,
    e.event_timestamp AS conversion_timestamp,
    o.order_id,
    o.revenue,
    o.currency
  FROM raw_events e
  INNER JOIN {{ ref('stg_orders') }} o
    ON e.user_id = o.user_id
    AND e.event_type = 'purchase'
    AND e.event_timestamp BETWEEN o.order_timestamp - INTERVAL '5 minutes'
      AND o.order_timestamp + INTERVAL '5 minutes'
),

touchpoints AS (
  SELECT
    s.session_id,
    s.user_id,
    s.entry_channel,
    s.entry_campaign,
    s.session_start,
    c.conversion_event_id,
    c.order_id,
    c.revenue,
    ROW_NUMBER() OVER (
      PARTITION BY c.order_id
      ORDER BY s.session_start
    ) AS touch_sequence,
    COUNT(*) OVER (
      PARTITION BY c.order_id
    ) AS total_touches
  FROM sessions s
  INNER JOIN conversions c
    ON s.user_id = c.user_id
    AND s.session_start <= c.conversion_timestamp
),

attribution AS (
  SELECT
    touchpoints.session_id,
    touchpoints.user_id,
    touchpoints.entry_channel,
    touchpoints.entry_campaign,
    touchpoints.order_id,
    touchpoints.revenue,
    touchpoints.touch_sequence,
    touchpoints.total_touches,

    -- First-touch attribution
    CASE WHEN touch_sequence = 1
      THEN revenue ELSE 0
    END AS first_touch_revenue,

    -- Last-touch attribution
    CASE WHEN touch_sequence = total_touches
      THEN revenue ELSE 0
    END AS last_touch_revenue,

    -- Linear attribution
    revenue / NULLIF(total_touches, 0) AS linear_revenue,

    -- Time-decay attribution (half-life = 7 days)
    revenue * POW(0.5, DATEDIFF('day', session_start, conversion_timestamp) / 7.0)
      / SUM(POW(0.5, DATEDIFF('day', session_start, conversion_timestamp) / 7.0))
        OVER (PARTITION BY order_id)
    AS time_decay_revenue

  FROM touchpoints
),

channel_summary AS (
  SELECT
    entry_channel AS channel,
    entry_campaign AS campaign,
    COUNT(DISTINCT order_id) AS attributed_orders,
    COUNT(DISTINCT user_id) AS attributed_users,
    SUM(first_touch_revenue) AS first_touch_total,
    SUM(last_touch_revenue) AS last_touch_total,
    SUM(linear_revenue) AS linear_total,
    SUM(time_decay_revenue) AS time_decay_total,
    AVG(total_touches) AS avg_touches_per_conversion
  FROM attribution
  GROUP BY entry_channel, entry_campaign
)

SELECT
  channel,
  campaign,
  attributed_orders,
  attributed_users,
  ROUND(first_touch_total, 2) AS first_touch_revenue,
  ROUND(last_touch_total, 2) AS last_touch_revenue,
  ROUND(linear_total, 2) AS linear_revenue,
  ROUND(time_decay_total, 2) AS time_decay_revenue,
  ROUND(avg_touches_per_conversion, 1) AS avg_touches,
  ROUND(time_decay_total / NULLIF(attributed_orders, 0), 2) AS revenue_per_order
FROM channel_summary
WHERE attributed_orders >= 5
ORDER BY time_decay_total DESC`;

// One subtle change: the time-decay half-life tuned from 7 to 14 days
const longModified = longOriginal
  .replace(
    "-- Time-decay attribution (half-life = 7 days)",
    "-- Time-decay attribution (half-life = 14 days)",
  )
  .replace(
    "DATEDIFF('day', session_start, conversion_timestamp) / 7.0)",
    "DATEDIFF('day', session_start, conversion_timestamp) / 14.0)",
  )
  .replace(
    "DATEDIFF('day', session_start, conversion_timestamp) / 7.0)",
    "DATEDIFF('day', session_start, conversion_timestamp) / 14.0)",
  );

export const CollapseUnchanged: Story = {
  name: "Collapse Unchanged (Needle in Haystack)",
  parameters: {
    docs: {
      description: {
        story:
          "A long model with one subtle parameter change buried deep in the code. Unchanged regions are automatically collapsed, making the actual change immediately visible.",
      },
    },
  },
  args: {
    original: longOriginal,
    modified: longModified,
    language: "sql",
    sideBySide: false,
    height: "400px",
  },
};

export const CollapseUnchangedSideBySide: Story = {
  name: "Collapse Unchanged (Side-by-Side)",
  args: {
    original: longOriginal,
    modified: longModified,
    language: "sql",
    sideBySide: true,
    height: "400px",
  },
};
