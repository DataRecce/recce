import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import {
  Flex,
  FlexProps,
  FormControl,
  FormHelperText,
  FormLabel,
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
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

export const QueryForm = ({ onPrimaryKeysChange, ...prob }: QueryFormProps) => {
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
    return Array.from(columnSet);
  }, [lineageGraph]);

  return (
    <Flex {...prob}>
      <FormControl>
        <FormLabel>Primary Keys</FormLabel>
        <AutoComplete
          openOnFocus
          multiple
          creatable
          onChange={(vals: string[]) => onPrimaryKeysChange(vals)}
        >
          <AutoCompleteInput placeholder="Search..." variant="filled">
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
        <FormHelperText>Composite primary key is allowed</FormHelperText>
      </FormControl>
    </Flex>
  );
};
