"use client";

import { ReactNode } from "react";

/**
 * This page intentionally renders nothing.
 * The LineagePage is rendered via the @lineage parallel route slot,
 * which stays mounted to preserve React Flow state across navigation.
 *
 * @see app/@lineage/page.tsx - The actual LineagePage render
 * @see packages/ui/src/components/app/MainLayout.tsx - Controls visibility of the parallel slot
 */
export default function LineageRoutingPage(): ReactNode {
  return null;
}
