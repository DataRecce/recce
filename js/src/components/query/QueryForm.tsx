import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { TagInput } from "@/utils/TagInput";
import { InfoIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  FlexProps,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuGroup,
  MenuItem,
  MenuList,
  Portal,
  Tooltip,
} from "@chakra-ui/react";
import { useMemo, useRef, useState } from "react";

interface QueryFormProps extends FlexProps {
  defaultPrimaryKeys: string[] | undefined;
  onPrimaryKeysChange: (primaryKeys: string[]) => void;
}

const PrimaryKeySelectMenu = ({
  defaultPrimaryKeys,
  onPrimaryKeysChange,
  ...prob
}: QueryFormProps) => {
  const { lineageGraph } = useLineageGraphContext();
  const [filter, setFilter] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>(
    defaultPrimaryKeys || []
  );
  const inputRef = useRef();

  const columns = useMemo(() => {
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

  const showNumberOfKeysSelected = (keys: string[]) => {
    if (keys.length > 1) {
      return `${keys.length} keys selected`;
    } else if (keys.length === 1) {
      return `${keys.length} key selected`;
    }
    return "";
  };

  const handleSelect = (column: string) => {
    if (!selectedKeys.includes(column)) {
      setFilter("");
      setSelectedKeys([...selectedKeys, column]);
      onPrimaryKeysChange([...selectedKeys, column]);
    }
  };

  const handleClear = () => {
    setFilter("");
    setSelectedKeys([]);
    onPrimaryKeysChange([]);
  };

  return (
    <InputGroup size="xs" width={"240px"}>
      <Menu isLazy closeOnSelect={false}>
        <MenuButton width={"100%"}>
          <Input
            placeholder="Start by typing key name..."
            size="xs"
            borderRadius={"4px"}
            value={showNumberOfKeysSelected(selectedKeys)}
          />
        </MenuButton>
        <Portal>
          <MenuList zIndex={"dropdown"} fontSize={"xs"} width={"240px"}>
            {/* Filter  */}
            <MenuGroup>
              <TagInput
                ref={inputRef}
                placeholder="Filter keys or add custom"
                value={filter}
                onValueChange={(val) => setFilter(val)}
                tags={selectedKeys}
                onTagChange={(tag, action) => {
                  if (action === "add" && tag) {
                    setSelectedKeys([...selectedKeys, tag]);
                    onPrimaryKeysChange([...selectedKeys, tag]);
                  } else {
                    setSelectedKeys(selectedKeys.filter((key) => key !== tag));
                    onPrimaryKeysChange(
                      selectedKeys.filter((key) => key !== tag)
                    );
                  }
                }}
                size="xs"
              />
            </MenuGroup>
            <MenuDivider />
            {/* Columns */}
            <MenuGroup>
              {filter !== "" && !columns.includes(filter) && (
                // <MenuGroup>
                <MenuItem
                  key={"custom-key-by-filter"}
                  onClick={() => handleSelect(filter)}
                >
                  Add &apos;{filter}&apos; to the list
                </MenuItem>
                // </MenuGroup>
              )}
              {columns
                .filter((column) => filter === "" || column.includes(filter))
                .filter((column) => !selectedKeys.includes(column))
                .map((column, cid) => (
                  <MenuItem
                    key={`option-${cid}`}
                    onClick={() => handleSelect(column)}
                  >
                    {column}
                  </MenuItem>
                ))}
            </MenuGroup>
          </MenuList>
        </Portal>
      </Menu>
      <InputRightElement>
        <Button
          variant={"link"}
          color={"#3182CE"}
          fontSize={"xs"}
          paddingTop="4px"
          paddingRight={"24px"}
          onClick={handleClear}
          hidden={selectedKeys.length === 0}
        >
          Clear
        </Button>
      </InputRightElement>
    </InputGroup>
  );
};

export const QueryForm = ({
  defaultPrimaryKeys,
  onPrimaryKeysChange,
  ...prob
}: QueryFormProps) => {
  const labelInfo =
    "Provide a primary key to perform query diff in data warehouse and only return changed rows.";

  return (
    <Flex {...prob}>
      <FormControl m="4px 8px">
        <FormLabel fontSize={"8pt"} margin={"0"}>
          Diff with Primary Key(s) (suggested){" "}
          <Tooltip label={labelInfo}>
            <InfoIcon color="gray.600" boxSize="3" />
          </Tooltip>
        </FormLabel>
        <PrimaryKeySelectMenu
          defaultPrimaryKeys={defaultPrimaryKeys}
          onPrimaryKeysChange={onPrimaryKeysChange}
        />
      </FormControl>
    </Flex>
  );
};
