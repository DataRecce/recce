import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { DropdownValuesInput } from "@/utils/DropdownValuesInput";
import { Field, Flex, FlexProps } from "@chakra-ui/react";
import { useMemo } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { PiInfo } from "react-icons/pi";

interface QueryFormProps extends FlexProps {
  defaultPrimaryKeys: string[] | undefined;
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

export const QueryForm = ({ defaultPrimaryKeys, onPrimaryKeysChange, ...prob }: QueryFormProps) => {
  const { lineageGraph, isActionAvailable } = useLineageGraphContext();

  const labelInfo =
    "Provide a primary key to perform query diff in data warehouse and only return changed rows.";

  const availableColumns = useMemo(() => {
    if (!lineageGraph) {
      return [];
    }
    const columnSet = new Set<string>();
    for (const modelName in lineageGraph.nodes) {
      const model = lineageGraph.nodes[modelName];
      const baseColumns = model.data.base?.columns;
      const currentColumns = model.data.current?.columns;

      for (const columnName in baseColumns) {
        columnSet.add(columnName);
      }

      for (const columnName in currentColumns) {
        columnSet.add(columnName);
      }
    }
    return Array.from(columnSet).sort();
  }, [lineageGraph]);

  return (
    <Flex {...prob}>
      <Field.Root m="4px 8px">
        <Field.Label fontSize={"8pt"} margin={"0"}>
          Diff with Primary Key(s) (suggested){" "}
          <Tooltip content={labelInfo} positioning={{ placement: "bottom-end" }}>
            <PiInfo color="gray.600" size="3" />
          </Tooltip>
        </Field.Label>
        <DropdownValuesInput
          className="no-track-pii-safe"
          unitName="key"
          defaultValues={defaultPrimaryKeys}
          suggestionList={availableColumns}
          onValuesChange={onPrimaryKeysChange}
          size="xs"
          width={"240px"}
          placeholder="Select or type to add keys"
          disabled={!isActionAvailable("query_diff_with_primary_key")}
        />
      </Field.Root>
    </Flex>
  );
};
