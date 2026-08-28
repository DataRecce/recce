import { describe, expectTypeOf, it } from "vitest";

import type {
  ArtifactHealth,
  CatalogCoverage,
  MergedLineageResponse,
  MergedNodeData,
  SchemaCoverage,
  ServerInfoResult,
} from "./index";

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

describe("ServerInfoResult schema evidence contract", () => {
  it("exports the bounded artifact health payload", () => {
    expectTypeOf<ArtifactHealth>().toEqualTypeOf<{
      status:
        | "complete"
        | "partial"
        | "empty"
        | "absent"
        | "not_applicable"
        | "unknown";
      expected_count: number;
      covered_count: number;
      catalog_entry_count: number;
      missing_node_count: number;
      missing_nodes: string[];
      missing_more: boolean;
      orphan_node_count: number;
      orphan_nodes: string[];
      orphan_more: boolean;
    }>();
  });

  it("exports optional nullable lineage evidence without rejecting legacy payloads", () => {
    expectTypeOf<SchemaCoverage>().toEqualTypeOf<{
      status: "complete" | "partial" | "unknown";
      unchecked_nodes: string[];
      unchecked_node_count: number;
      more: boolean;
    }>();
    expectTypeOf<MergedLineageResponse["artifact_health"]>().toEqualTypeOf<
      | {
          base?: ArtifactHealth | null;
          current?: ArtifactHealth | null;
        }
      | null
      | undefined
    >();
    expectTypeOf<MergedLineageResponse["schema_coverage"]>().toEqualTypeOf<
      SchemaCoverage | null | undefined
    >();
    expectTypeOf<ServerInfoResult["artifact_health"]>().toEqualTypeOf<
      | {
          base?: ArtifactHealth | null;
          current?: ArtifactHealth | null;
        }
      | null
      | undefined
    >();
    expectTypeOf<ServerInfoResult["schema_coverage"]>().toEqualTypeOf<
      SchemaCoverage | null | undefined
    >();
  });

  it("exports the optional per-node comparison status", () => {
    expectTypeOf<MergedNodeData["schema_comparison_status"]>().toEqualTypeOf<
      "complete" | "unchecked" | "not_applicable" | undefined
    >();
  });
});
