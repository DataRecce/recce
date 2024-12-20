import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { DropdownValuesInput } from "@/utils/DropdownValuesInput";
import { InfoIcon } from "@chakra-ui/icons";
import {
  Flex,
  FlexProps,
  FormControl,
  FormLabel,
  Tooltip,
} from "@chakra-ui/react";
import { useMemo } from "react";

interface QueryFormProps extends FlexProps {
  defaultPrimaryKeys: string[] | undefined;
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

export const QueryForm = ({
  defaultPrimaryKeys,
  onPrimaryKeysChange,
  ...prob
}: QueryFormProps) => {
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
      <FormControl m="4px 8px">
        <FormLabel fontSize={"8pt"} margin={"0"}>
          Diff with Primary Key(s) (suggested){" "}
          <Tooltip label={labelInfo} placement="bottom-end">
            <InfoIcon color="gray.600" boxSize="3" />
          </Tooltip>
        </FormLabel>
        <DropdownValuesInput
          unitName="key"
          defaultValues={defaultPrimaryKeys}
          suggestionList={availableColumns}
          onValuesChange={onPrimaryKeysChange}
          size="xs"
          width={"240px"}
          placeholder="Start by typing key name..."
          isDisabled={!isActionAvailable("query_diff_with_primary_key")}
        />
      </FormControl>
    </Flex>
  );
};
