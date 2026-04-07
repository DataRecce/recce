export interface AdapterField {
  /** Field name in Cloud's WarehouseConfig (e.g., "account", "dbname") */
  name: string;
  /** Display label */
  label: string;
  /** Input type */
  type: "text" | "password" | "number" | "textarea";
  /** Whether the user must fill this in (not prefilled) */
  isCredential: boolean;
  /** Field name in dbt connection_info() if different from `name` (e.g., "database" → "dbname") */
  prefillFrom?: string;
  /** Whether this field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export interface AdapterDefinition {
  type: string;
  label: string;
  fields: AdapterField[];
}

/**
 * Cloud-supported adapters and their form fields.
 * Field names match Cloud's WarehouseConfig types exactly.
 * `prefillFrom` maps dbt connection_info() field names to Cloud field names where they differ.
 */
export const SUPPORTED_ADAPTERS: Record<string, AdapterDefinition> = {
  snowflake: {
    type: "snowflake",
    label: "Snowflake",
    fields: [
      {
        name: "account",
        label: "Account",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "user",
        label: "User",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "warehouse",
        label: "Warehouse",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "database",
        label: "Database",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "schema",
        label: "Schema",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "password",
        label: "Password",
        type: "password",
        isCredential: true,
        required: true,
        placeholder: "Or use private key below",
      },
      {
        name: "private_key",
        label: "Private Key",
        type: "textarea",
        isCredential: true,
        required: false,
        placeholder: "Paste PEM-encoded private key",
      },
      {
        name: "private_key_passphrase",
        label: "Private Key Passphrase",
        type: "password",
        isCredential: true,
        required: false,
      },
    ],
  },
  databricks: {
    type: "databricks",
    label: "Databricks",
    fields: [
      {
        name: "host",
        label: "Host",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "http_path",
        label: "HTTP Path",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "catalog",
        label: "Catalog",
        type: "text",
        isCredential: false,
        required: false,
        prefillFrom: "database",
      },
      {
        name: "schema",
        label: "Schema",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "token",
        label: "Access Token",
        type: "password",
        isCredential: true,
        required: true,
      },
    ],
  },
  bigquery: {
    type: "bigquery",
    label: "BigQuery",
    fields: [
      {
        name: "project",
        label: "Project",
        type: "text",
        isCredential: false,
        required: true,
        prefillFrom: "database",
      },
      {
        name: "dataset",
        label: "Dataset",
        type: "text",
        isCredential: false,
        required: true,
        prefillFrom: "schema",
      },
      {
        name: "keyfile_json",
        label: "Service Account Key (JSON)",
        type: "textarea",
        isCredential: true,
        required: true,
        placeholder: "Paste service account JSON",
      },
    ],
  },
  redshift: {
    type: "redshift",
    label: "Redshift",
    fields: [
      {
        name: "host",
        label: "Host",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "user",
        label: "User",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "port",
        label: "Port",
        type: "number",
        isCredential: false,
        required: true,
      },
      {
        name: "dbname",
        label: "Database",
        type: "text",
        isCredential: false,
        required: true,
        prefillFrom: "database",
      },
      {
        name: "schema",
        label: "Schema",
        type: "text",
        isCredential: false,
        required: true,
      },
      {
        name: "password",
        label: "Password",
        type: "password",
        isCredential: true,
        required: true,
      },
    ],
  },
};

/**
 * Check if an adapter type is supported for Cloud DW setup.
 */
export function isSupportedAdapter(adapterType: string): boolean {
  return adapterType in SUPPORTED_ADAPTERS;
}

/**
 * Build prefilled form values from connection_info() data.
 * Maps dbt field names to Cloud field names using `prefillFrom`.
 */
export function buildPrefillValues(
  adapterType: string,
  connectionInfo: Record<string, unknown>,
): Record<string, string> {
  const adapter = SUPPORTED_ADAPTERS[adapterType];
  if (!adapter) return {};

  const values: Record<string, string> = {};
  for (const field of adapter.fields) {
    if (field.isCredential) continue;
    const sourceField = field.prefillFrom ?? field.name;
    const value = connectionInfo[sourceField];
    if (value != null) {
      values[field.name] = String(value);
    }
  }
  return values;
}
