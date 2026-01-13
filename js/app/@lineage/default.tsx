/**
 * @lineage Parallel Route - Default
 *
 * This file is rendered when navigating to routes that don't have
 * a matching @lineage segment. It still renders LineagePage to
 * keep it mounted (though hidden via CSS in MainLayout).
 *
 * This is crucial for preserving React state across navigation.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#defaultjs
 */
"use client";

import { LineagePageOss as LineagePage } from "@datarecce/ui/components/lineage/LineagePageOss";

export default function LineageSlotDefault() {
  // Still render LineagePage to keep it mounted
  // MainLayout controls visibility via CSS display property
  return <LineagePage />;
}
