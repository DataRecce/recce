import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { InfoIcon } from "@chakra-ui/icons";
import {
  Flex,
  FlexProps,
  FormControl,
  FormLabel,
  Tooltip,
} from "@chakra-ui/react";
import {
  AutoComplete,
  AutoCompleteCreatable,
  AutoCompleteInput,
  AutoCompleteItem,
  AutoCompleteList,
  AutoCompleteTag,
  ItemTag,
} from "@choc-ui/chakra-autocomplete";
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
  const { lineageGraph } = useLineageGraphContext();

  const columns = useMemo(() => {
    if (!lineageGraph) {
      return [];
    }

    const columnSet = new Set();
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

  const labelInfo =
    "When a primary key is present, the query difference is computed in the warehouse through joins. Otherwise, it's computed on the client side.";

  return (
    <Flex {...prob}>
      <FormControl m="4px 8px">
        <FormLabel>
          Primary key{" "}
          <Tooltip label={labelInfo}>
            <InfoIcon color="gray.600" boxSize="3" />
          </Tooltip>
        </FormLabel>
        <AutoComplete
          restoreOnBlurIfEmpty={false}
          multiple
          creatable
          onChange={(vals: string[]) => onPrimaryKeysChange(vals)}
          defaultValues={
            defaultPrimaryKeys !== undefined && defaultPrimaryKeys.length !== 0
              ? defaultPrimaryKeys
              : undefined
          }
        >
          <AutoCompleteInput
            placeholder="Select primary key..."
            variant="outline"
          >
            {({ tags }: { tags: ItemTag[] }) =>
              tags.map((tag, tid) => (
                <AutoCompleteTag
                  key={tid}
                  label={tag.label}
                  onRemove={tag.onRemove}
                />
              ))
            }
          </AutoCompleteInput>
          <AutoCompleteList>
            {columns.map((column, cid) => (
              <AutoCompleteItem key={`option-${cid}`} value={column}>
                {column}
              </AutoCompleteItem>
            ))}
            <AutoCompleteCreatable>
              {({ value }) => <Flex>Add &apos;{value}&apos; to List</Flex>}
            </AutoCompleteCreatable>
          </AutoCompleteList>
        </AutoComplete>
      </FormControl>
    </Flex>
  );
};
