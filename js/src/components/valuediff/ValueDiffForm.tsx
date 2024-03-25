import { ValueDiffParams } from "@/lib/api/valuediff";
import { RunFormProps } from "../run/types";
import {
  Checkbox,
  FormControl,
  FormLabel,
  Input,
  VStack,
} from "@chakra-ui/react";

import { Select } from "chakra-react-select";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { LineageGraphNode } from "../lineage/lineage";
import _ from "lodash";
import { useEffect, useState } from "react";
import { NodeColumnData, NodeData } from "@/lib/api/lineage";

interface ValueDiffFormParams {
  model: string;
  primary_key?: string | (string | undefined)[];
  columns?: string[];
}

interface ValueDiffFormProp extends RunFormProps<ValueDiffFormParams> {}

export function extractColumns(node: LineageGraphNode) {
  function getColumns(nodeData: NodeData) {
    return nodeData && nodeData.columns ? Object.values(nodeData.columns) : [];
  }

  const baseColumns = getColumns(node.data.base!!);
  const currentColumns = getColumns(node.data.current!!);

  const union: NodeColumnData[] = [];
  baseColumns.forEach((column) => {
    if (!union.some((c) => c.name === column.name)) {
      union.push(column);
    }
  });
  currentColumns.forEach((column) => {
    if (!union.some((c) => c.name === column.name)) {
      union.push(column);
    }
  });

  return union;
}

export function extractColumnNames(node: LineageGraphNode) {
  function getNames(nodeData: NodeData) {
    return nodeData && nodeData.columns
      ? Object.values(nodeData.columns).map((column) => column.name)
      : [];
  }

  const baseColumns = getNames(node.data.base!!);
  const currentColumns = getNames(node.data.current!!);

  // keep the columns order
  const union: string[] = [];
  baseColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });
  currentColumns.forEach((column) => {
    if (!union.includes(column)) {
      union.push(column);
    }
  });

  return union;
}

export function ValueDiffForm({
  params,
  onParamsChanged,
  setIsReadyToExecute,
}: ValueDiffFormProp) {
  const { lineageGraph } = useLineageGraphContext();
  const [allColumns, setAllColumns] = useState<boolean>(
    !params.columns || params.columns.length === 0
  );

  const model = params?.model;
  const primaryKey = params?.primary_key;
  const node = _.find(lineageGraph?.nodes, {
    name: params?.model,
  });
  const nodePrimaryKey = node?.data.current?.primary_key;

  useEffect(() => {
    if (!primaryKey && nodePrimaryKey) {
      onParamsChanged({
        ...params,
        primary_key: nodePrimaryKey,
      });
    }
  }, [primaryKey, nodePrimaryKey, params, onParamsChanged]);

  useEffect(() => {
    setIsReadyToExecute(primaryKey && model ? true : false);
  }, [primaryKey, model, setIsReadyToExecute]);

  const columnNames = node ? extractColumnNames(node) : [];

  // primaryKey can be array or string, map to array
  const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];

  return (
    <VStack gap={5} m="8px 24px" paddingBottom="200px">
      <FormControl>
        <FormLabel>Model</FormLabel>
        <Input isReadOnly={true} value={params?.model} />
      </FormControl>
      <FormControl>
        <FormLabel>Primary key</FormLabel>
        <Select
          placeholder="Select primary key"
          isMulti
          closeMenuOnSelect={false}
          options={(columnNames || []).map((c) => ({ label: c, value: c }))}
          value={(primaryKeys || []).map((c) => ({
            label: c,
            value: c,
          }))}
          onChange={(options) => {
            onParamsChanged({
              ...params,
              primary_key:
                options.length == 1
                  ? options[0].value
                  : options.map((v) => v.value),
            });
          }}
        ></Select>
      </FormControl>
      <FormControl>
        <FormLabel>Columns</FormLabel>
        <Checkbox
          marginBottom="10px"
          isChecked={allColumns}
          onChange={(e) => {
            setAllColumns(e.target.checked);
            onParamsChanged({
              ...params,
              columns: undefined,
            });
          }}
        >
          All columns
        </Checkbox>
        {!allColumns && (
          <Select
            isMulti
            closeMenuOnSelect={false}
            options={(columnNames || []).map((c) => ({ label: c, value: c }))}
            value={(params.columns || []).map((c) => ({
              label: c,
              value: c,
            }))}
            onChange={(options) => {
              onParamsChanged({
                ...params,
                columns: (options || []).map((v) => v.value),
              });
            }}
          ></Select>
        )}
      </FormControl>
    </VStack>
  );
}
