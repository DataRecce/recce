import { describe, expect, it } from "vitest";
import {
  buildPrefillValues,
  getDefaultAuthMethod,
  getFieldsForAuthMethod,
  isSupportedAdapter,
  SUPPORTED_ADAPTERS,
} from "../warehouseAdapters";

describe("isSupportedAdapter", () => {
  it("returns true for supported adapters", () => {
    expect(isSupportedAdapter("snowflake")).toBe(true);
    expect(isSupportedAdapter("databricks")).toBe(true);
    expect(isSupportedAdapter("bigquery")).toBe(true);
    expect(isSupportedAdapter("redshift")).toBe(true);
  });

  it("returns false for unsupported adapters", () => {
    expect(isSupportedAdapter("postgres")).toBe(false);
    expect(isSupportedAdapter("duckdb")).toBe(false);
    expect(isSupportedAdapter("")).toBe(false);
  });
});

describe("getDefaultAuthMethod", () => {
  it("returns first auth method for each adapter", () => {
    expect(getDefaultAuthMethod("snowflake")).toBe("user-password");
    expect(getDefaultAuthMethod("databricks")).toBe("token");
    expect(getDefaultAuthMethod("bigquery")).toBe("service-account-json");
    expect(getDefaultAuthMethod("redshift")).toBe("password");
  });

  it("returns empty string for unsupported adapter", () => {
    expect(getDefaultAuthMethod("postgres")).toBe("");
  });
});

describe("getFieldsForAuthMethod", () => {
  it("returns common + auth-specific fields for snowflake user-password", () => {
    const fields = getFieldsForAuthMethod("snowflake", "user-password");
    const names = fields.map((f) => f.name);
    expect(names).toContain("account");
    expect(names).toContain("user");
    expect(names).toContain("warehouse");
    expect(names).toContain("database");
    expect(names).toContain("schema");
    expect(names).toContain("password");
    expect(names).not.toContain("private_key");
  });

  it("returns common + auth-specific fields for snowflake key-pair", () => {
    const fields = getFieldsForAuthMethod("snowflake", "key-pair");
    const names = fields.map((f) => f.name);
    expect(names).toContain("account");
    expect(names).toContain("private_key");
    expect(names).toContain("private_key_passphrase");
    expect(names).not.toContain("password");
  });

  it("returns common + auth-specific fields for databricks token", () => {
    const fields = getFieldsForAuthMethod("databricks", "token");
    const names = fields.map((f) => f.name);
    expect(names).toContain("host");
    expect(names).toContain("http_path");
    expect(names).toContain("token");
    expect(names).not.toContain("client_id");
  });

  it("returns common + auth-specific fields for databricks oauth", () => {
    const fields = getFieldsForAuthMethod("databricks", "oauth");
    const names = fields.map((f) => f.name);
    expect(names).toContain("host");
    expect(names).toContain("client_id");
    expect(names).toContain("client_secret");
    expect(names).not.toContain("token");
  });

  it("returns empty array for unsupported adapter", () => {
    expect(getFieldsForAuthMethod("postgres", "password")).toEqual([]);
  });

  it("returns only common fields for unknown auth method", () => {
    const fields = getFieldsForAuthMethod("snowflake", "unknown");
    const names = fields.map((f) => f.name);
    expect(names).toContain("account");
    expect(names).not.toContain("password");
    expect(names).not.toContain("private_key");
  });
});

describe("buildPrefillValues", () => {
  it("prefills snowflake common fields from connection_info", () => {
    const connInfo = {
      account: "abc.us-east-1",
      user: "RECCE",
      warehouse: "LOAD_WH",
      database: "MY_DB",
      schema: "PUBLIC",
    };
    const values = buildPrefillValues("snowflake", connInfo);
    expect(values).toEqual({
      account: "abc.us-east-1",
      user: "RECCE",
      warehouse: "LOAD_WH",
      database: "MY_DB",
      schema: "PUBLIC",
    });
  });

  it("maps prefillFrom fields for bigquery", () => {
    const connInfo = {
      database: "my-gcp-project",
      schema: "my_dataset",
    };
    const values = buildPrefillValues("bigquery", connInfo);
    expect(values).toEqual({
      project: "my-gcp-project",
      dataset: "my_dataset",
    });
  });

  it("maps prefillFrom fields for databricks", () => {
    const connInfo = {
      host: "adb-123.azuredatabricks.net",
      http_path: "/sql/1.0/warehouses/abc",
      database: "my_catalog",
      schema: "default",
    };
    const values = buildPrefillValues("databricks", connInfo);
    expect(values).toEqual({
      host: "adb-123.azuredatabricks.net",
      http_path: "/sql/1.0/warehouses/abc",
      catalog: "my_catalog",
      schema: "default",
    });
  });

  it("maps prefillFrom fields for redshift", () => {
    const connInfo = {
      host: "cluster.redshift.amazonaws.com",
      user: "admin",
      port: 5439,
      database: "mydb",
      schema: "public",
    };
    const values = buildPrefillValues("redshift", connInfo);
    expect(values).toEqual({
      host: "cluster.redshift.amazonaws.com",
      user: "admin",
      port: "5439",
      dbname: "mydb",
      schema: "public",
    });
  });

  it("skips null/undefined values", () => {
    const connInfo = {
      account: "abc",
      user: null,
      warehouse: undefined,
      database: "DB",
      schema: "S",
    };
    const values = buildPrefillValues("snowflake", connInfo);
    expect(values).toEqual({
      account: "abc",
      database: "DB",
      schema: "S",
    });
  });

  it("returns empty object for unsupported adapter", () => {
    expect(buildPrefillValues("postgres", { host: "localhost" })).toEqual({});
  });
});

describe("SUPPORTED_ADAPTERS structure", () => {
  it("snowflake has 2 auth methods", () => {
    expect(SUPPORTED_ADAPTERS.snowflake.authMethods).toHaveLength(2);
  });

  it("databricks has 2 auth methods", () => {
    expect(SUPPORTED_ADAPTERS.databricks.authMethods).toHaveLength(2);
  });

  it("bigquery has 1 auth method", () => {
    expect(SUPPORTED_ADAPTERS.bigquery.authMethods).toHaveLength(1);
  });

  it("redshift has 1 auth method", () => {
    expect(SUPPORTED_ADAPTERS.redshift.authMethods).toHaveLength(1);
  });

  it("all auth method fields are credentials", () => {
    for (const adapter of Object.values(SUPPORTED_ADAPTERS)) {
      for (const method of adapter.authMethods) {
        for (const field of method.fields) {
          expect(field.isCredential).toBe(true);
        }
      }
    }
  });

  it("all common fields are not credentials", () => {
    for (const adapter of Object.values(SUPPORTED_ADAPTERS)) {
      for (const field of adapter.commonFields) {
        expect(field.isCredential).toBe(false);
      }
    }
  });
});
