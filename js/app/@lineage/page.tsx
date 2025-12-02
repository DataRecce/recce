/**
 * @lineage Parallel Route - Page
 *
 * This parallel route renders the LineagePage component.
 * It is always mounted in the layout to preserve React state
 * (React Flow graph state, zoom level, selected nodes, etc.)
 */
"use client";

import { LineagePage } from "@/components/lineage/LineagePage";

export default function LineageSlotPage() {
  return <LineagePage />;
}
