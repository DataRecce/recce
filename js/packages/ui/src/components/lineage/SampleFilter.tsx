"use client";

import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { IoChevronDown, IoChevronForward, IoClose } from "react-icons/io5";
import type { NodeColumnData } from "../../api";
import type { WhereFilter } from "../../api/profile";

const OPERATORS = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
  { value: "is_null", label: "IS NULL" },
  { value: "is_not_null", label: "IS NOT NULL" },
] as const;

type OperatorValue = (typeof OPERATORS)[number]["value"];

const NULL_OPERATORS: OperatorValue[] = ["is_null", "is_not_null"];

interface SampleFilterProps {
  columns: NodeColumnData[];
  filter: WhereFilter | undefined;
  onFilterChange: (filter: WhereFilter | undefined) => void;
}

function formatFilterSummary(filter: WhereFilter): string {
  const op = OPERATORS.find((o) => o.value === filter.operator);
  const opLabel = op?.label ?? filter.operator;
  if (NULL_OPERATORS.includes(filter.operator as OperatorValue)) {
    return `${filter.column} ${opLabel}`;
  }
  return `${filter.column} ${opLabel} ${filter.value}`;
}

export function SampleFilter({
  columns,
  filter,
  onFilterChange,
}: SampleFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [column, setColumn] = useState<string | null>(filter?.column ?? null);
  const [operator, setOperator] = useState<OperatorValue>(
    (filter?.operator as OperatorValue) ?? ">=",
  );
  const [value, setValue] = useState(filter?.value ?? "");

  const isNullOp = NULL_OPERATORS.includes(operator);

  const emitFilter = (col: string | null, op: OperatorValue, val: string) => {
    if (!col) {
      onFilterChange(undefined);
      return;
    }
    if (!NULL_OPERATORS.includes(op) && !val) {
      onFilterChange(undefined);
      return;
    }
    const f: WhereFilter = {
      column: col,
      operator: op,
      ...(NULL_OPERATORS.includes(op) ? {} : { value: val }),
    };
    onFilterChange(f);
  };

  const handleClear = () => {
    setColumn(null);
    setValue("");
    onFilterChange(undefined);
  };

  const hasFilter = filter !== undefined;

  return (
    <Box sx={{ px: 2, py: 0.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        sx={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setIsExpanded(!isExpanded)}
        spacing={0.5}
      >
        {isExpanded ? (
          <IoChevronDown size={12} />
        ) : (
          <IoChevronForward size={12} />
        )}
        <Typography variant="caption" fontWeight="bold" color="text.secondary">
          {hasFilter
            ? `Filter: ${formatFilterSummary(filter)}`
            : "Sample filter"}
        </Typography>
        {hasFilter && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            sx={{ p: 0.25 }}
          >
            <IoClose size={12} />
          </IconButton>
        )}
      </Stack>

      <Collapse in={isExpanded}>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
          <Autocomplete
            size="small"
            options={columns.map((c) => c.name)}
            value={column}
            onChange={(_, newValue) => {
              setColumn(newValue);
              emitFilter(newValue, operator, value);
            }}
            renderInput={(params) => (
              <TextField {...params} placeholder="Column" />
            )}
            sx={{ minWidth: 140, flex: 1 }}
          />
          <Select
            size="small"
            value={operator}
            onChange={(e) => {
              const op = e.target.value as OperatorValue;
              setOperator(op);
              emitFilter(column, op, value);
            }}
            sx={{ minWidth: 80 }}
          >
            {OPERATORS.map((op) => (
              <MenuItem key={op.value} value={op.value}>
                {op.label}
              </MenuItem>
            ))}
          </Select>
          {!isNullOp && (
            <TextField
              size="small"
              placeholder="Value"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                emitFilter(column, operator, e.target.value);
              }}
              sx={{ minWidth: 100, flex: 1 }}
            />
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}
