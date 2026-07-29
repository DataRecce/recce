import { describe, expectTypeOf, it } from "vitest";

import type { CatalogCoverage, ServerInfoResult } from "./index";

type CatalogStatus =
  | "complete"
  | "partial"
  | "empty"
  | "absent"
  | "not_applicable"
  | "unknown";

describe("ServerInfoResult catalog coverage contract", () => {
  it("exports the canonical optional and nullable cloud payload", () => {
    expectTypeOf<CatalogCoverage>().toEqualTypeOf<{
      status: CatalogStatus;
      warn: boolean;
      covered_count: number;
      expected_count: number;
      catalog_entry_count: number;
      computed_at: string;
    }>();

    expectTypeOf<ServerInfoResult["catalog_coverage"]>().toEqualTypeOf<
      CatalogCoverage | null | undefined
    >();
  });
});
