import { Box, Field, NativeSelect } from "@chakra-ui/react";
import { HistogramDiffParams } from "@/lib/api/profile";
import useModelColumns from "@/lib/hooks/useModelColumns";
import { RunFormProps } from "../run/types";

function isStringDataType(columnType: string) {
  const stringDataTypes = [
    "CHAR",
    "VARCHAR",
    "TINYTEXT",
    "TEXT",
    "MEDIUMTEXT",
    "LONGTEXT",
    "NCHAR",
    "NVARCHAR",
    "VARCHAR2",
    "NVARCHAR2",
    "CLOB",
    "NCLOB",
    "VARCHAR(MAX)",
    "XML",
    "JSON",
  ];
  // Normalize columnType by removing spaces and converting to uppercase
  const normalizedType = columnType.trim().toUpperCase();

  // Check if columnType is in the predefined list
  if (stringDataTypes.includes(normalizedType)) {
    return true;
  }

  // Match types that have a length specification (e.g., VARCHAR(255))
  const regex = /^(VARCHAR|NVARCHAR|VARCHAR2|NVARCHAR2|CHAR|NCHAR)\(\d+\)$/;
  return regex.test(normalizedType);
}

function isBooleanDataType(columnType: string) {
  const booleanDataTypes = [
    "BOOLEAN", // PostgreSQL, SQLite, and others with native boolean support
    "TINYINT(1)", // MySQL/MariaDB uses TINYINT(1) to represent boolean values
    "BIT", // SQL Server and others use BIT to represent boolean values, where 1 is true and 0 is false
    "NUMBER(1)", // Oracle uses NUMBER(1) where 1 is true and 0 is false, as it does not have a native BOOLEAN type
    "BOOL", // Snowflake and PostgreSQL also support BOOL as an alias for BOOLEAN
  ];
  return booleanDataTypes.includes(columnType.toUpperCase());
}

function isDateTimeType(columnType: string) {
  const sql_datetime_types = [
    "DATE",
    "DATETIME",
    "TIMESTAMP",
    "TIME",
    "YEAR", // Specific to MySQL/MariaDB
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET", // Specific to SQL Server
    "INTERVAL", // Common in PostgreSQL and Oracle
    "TIMESTAMPTZ",
    "TIMETZ", // Specific to PostgreSQL
    "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMP WITH LOCAL TIME ZONE", // Oracle
    "TIMESTAMP_LTZ",
    "TIMESTAMP_NTZ",
    "TIMESTAMP_TZ", // Specific to Snowflake
  ];
  return sql_datetime_types.includes(columnType.toUpperCase());
}

type HistogramDiffEditProps = RunFormProps<HistogramDiffParams>;

export function supportsHistogramDiff(columnType: string) {
  return (
    !isStringDataType(columnType) &&
    !isBooleanDataType(columnType) &&
    !isDateTimeType(columnType)
  );
}

export function HistogramDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: HistogramDiffEditProps) {
  const {
    columns: allColumns,
    isLoading,
    error,
  } = useModelColumns(params.model);
  const columns = allColumns.filter(
    (c) =>
      !isStringDataType(c.type) &&
      !isBooleanDataType(c.type) &&
      !isDateTimeType(c.type),
  );

  if (isLoading) {
    return <Box>Loading...</Box>;
  }

  if (allColumns.length === 0 || error) {
    return (
      <Box>
        Error: Please provide the &apos;catalog.json&apos; to list column
        candidates
      </Box>
    );
  }

  return (
    <Box m="16px">
      <Field.Root>
        <Field.Label>Pick a column to show Histogram Diff</Field.Label>
        <NativeSelect.Root disabled={columns.length === 0}>
          <NativeSelect.Field
            value={params.column_name}
            onChange={(e) => {
              const columnName = e.target.value;
              setIsReadyToExecute(!!columnName);
              const columnType =
                columns.find((c) => c.name === columnName)?.type ?? "";
              onParamsChanged({
                ...params,
                column_name: columnName,
                column_type: columnType,
              });
            }}
            placeholder={
              columns.length !== 0
                ? "Select column"
                : "No numeric column is available"
            }
          >
            {columns.map((c) => (
              <option key={c.name} value={c.name} className="no-track-pii-safe">
                {c.name} : {c.type}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
    </Box>
  );
}
