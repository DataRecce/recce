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

export interface AuthMethod {
  /** Auth method key (e.g., "user-password", "key-pair") */
  value: string;
  /** Display label for the selector */
  label: string;
  /** Fields specific to this auth method */
  fields: AdapterField[];
}

export interface AdapterDefinition {
  type: string;
  label: string;
  /** Common fields shown regardless of auth method */
  commonFields: AdapterField[];
  /** Auth methods — if length === 1, no selector is shown */
  authMethods: AuthMethod[];
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
    commonFields: [
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
    ],
    authMethods: [
      {
        value: "user-password",
        label: "User & Password",
        fields: [
          {
            name: "password",
            label: "Password",
            type: "password",
            isCredential: true,
            required: true,
          },
        ],
      },
      {
        value: "key-pair",
        label: "Key Pair",
        fields: [
          {
            name: "private_key",
            label: "Private Key",
            type: "textarea",
            isCredential: true,
            required: true,
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
    ],
  },
  databricks: {
    type: "databricks",
    label: "Databricks",
    commonFields: [
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
    ],
    authMethods: [
      {
        value: "token",
        label: "Token",
        fields: [
          {
            name: "token",
            label: "Access Token",
            type: "password",
            isCredential: true,
            required: true,
          },
        ],
      },
      {
        value: "oauth",
        label: "OAuth (M2M)",
        fields: [
          {
            name: "client_id",
            label: "Client ID",
            type: "text",
            isCredential: true,
            required: true,
          },
          {
            name: "client_secret",
            label: "Client Secret",
            type: "password",
            isCredential: true,
            required: true,
          },
        ],
      },
    ],
  },
  bigquery: {
    type: "bigquery",
    label: "BigQuery",
    commonFields: [
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
    ],
    authMethods: [
      {
        value: "service-account-json",
        label: "Service Account JSON",
        fields: [
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
    ],
  },
  redshift: {
    type: "redshift",
    label: "Redshift",
    commonFields: [
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
    ],
    authMethods: [
      {
        value: "password",
        label: "Password",
        fields: [
          {
            name: "password",
            label: "Password",
            type: "password",
            isCredential: true,
            required: true,
          },
        ],
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
 * Get the default auth method for an adapter.
 */
export function getDefaultAuthMethod(adapterType: string): string {
  const adapter = SUPPORTED_ADAPTERS[adapterType];
  return adapter?.authMethods[0]?.value ?? "";
}

/**
 * Get all fields (common + auth-method-specific) for the given adapter and auth method.
 */
export function getFieldsForAuthMethod(
  adapterType: string,
  authMethod: string,
): AdapterField[] {
  const adapter = SUPPORTED_ADAPTERS[adapterType];
  if (!adapter) return [];
  const auth = adapter.authMethods.find((m) => m.value === authMethod);
  return [...adapter.commonFields, ...(auth?.fields ?? [])];
}

/**
 * Build prefilled form values from connection_info() data.
 * Maps dbt field names to Cloud field names using `prefillFrom`.
 * Only prefills common (non-credential) fields.
 */
export function buildPrefillValues(
  adapterType: string,
  connectionInfo: Record<string, unknown>,
): Record<string, string> {
  const adapter = SUPPORTED_ADAPTERS[adapterType];
  if (!adapter) return {};

  const values: Record<string, string> = {};
  for (const field of adapter.commonFields) {
    if (field.isCredential) continue;
    const sourceField = field.prefillFrom ?? field.name;
    const value = connectionInfo[sourceField];
    if (value != null) {
      values[field.name] = String(value);
    }
  }
  return values;
}
