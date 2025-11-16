import { Field, Flex, FlexProps } from "@chakra-ui/react";
import { useMemo } from "react";
import { PiInfo } from "react-icons/pi";
import { Tooltip } from "@/components/ui/tooltip";
import { NodeColumnData } from "@/lib/api/info";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { DropdownValuesInput } from "@/utils/DropdownValuesInput";

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
      const combinedColumns: Record<string, NodeColumnData | undefined> = {
        ...(model.data.data.base?.columns ?? {}),
        ...(model.data.data.current?.columns ?? {}),
      };

      Object.entries(combinedColumns).forEach(([columnName, col]) => {
        if (col?.unique) {
          columnSet.add(columnName);
        }
      });
    }
    return Array.from(columnSet).sort();
  }, [lineageGraph]);

  return (
    <Flex {...prob}>
      <Field.Root m="0 0.5rem" gap={0}>
        <Field.Label fontSize="0.625rem" margin={0}>
          Diff with Primary Key(s) (suggested){" "}
          <Tooltip
            content={labelInfo}
            positioning={{ placement: "bottom-end" }}
          >
            <PiInfo color="gray.600" />
          </Tooltip>
        </Field.Label>
        <DropdownValuesInput
          className="no-track-pii-safe"
          unitName="key"
          defaultValues={defaultPrimaryKeys}
          suggestionList={availableColumns}
          onValuesChange={onPrimaryKeysChange}
          size="2xs"
          width={"240px"}
          placeholder="Select or type to add keys"
          disabled={!isActionAvailable("query_diff_with_primary_key")}
        />
      </Field.Root>
    </Flex>
  );
};
