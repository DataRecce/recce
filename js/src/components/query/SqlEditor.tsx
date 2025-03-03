import {
  Flex,
  Text,
  Stack,
  Badge,
  Spacer,
  IconButton,
  Button,
  Icon,
  Box,
  BoxProps,
} from "@chakra-ui/react";
import { EditorProps, DiffEditor, Editor } from "@monaco-editor/react";
import { on } from "events";
import { BiLogoXing } from "react-icons/bi";
import { FaPlay } from "react-icons/fa6";
import { RiPlayMiniFill } from "react-icons/ri";
import { VscDebugStart } from "react-icons/vsc";

export interface SqlEditorProps {
  language?: string;
  theme?: string;
  value: string;
  baseValue?: string;
  onChange?: (value: string) => void;
  onChangeBase?: (value: string) => void;
  onRun?: () => void;
  onRunBase?: () => void;
  onRunDiff?: () => void;
  options?: EditorProps["options"];
  label?: string;
  CustomEditor?: React.ReactElement<any, any>;
}

export interface DualSqlEditorProps extends SqlEditorProps {
  labels?: [string, string]; // [baseLabel, currentLabel]
  BaseEnvironmentSetupGuide?: React.ReactElement<any, any>;
}

const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onRun,
  onRunBase,
  onRunDiff,
  label,
  CustomEditor,
  options = {},
  ...props
}: SqlEditorProps) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && onChange) {
      onChange(value);
    }
  };

  return (
    <>
      {(label || onRun || onRunBase) && (
        <Flex
          backgroundColor="#EDF2F880"
          height="40px"
          minH="40px"
          fontSize={"14px"}
          align="center"
          margin={"0"}
          padding={"0px 16px"}>
          <Text as="b">{label ? label.toUpperCase() : ""}</Text>
          <Spacer />
          {(onRun || onRunBase) && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRun || onRunBase}
              backgroundColor={"white"}
              // leftIcon={<Icon as={RiPlayMiniFill} />}
              leftIcon={<Icon as={FaPlay} />}
              padding={"6px 12px"}>
              Run Query
            </Button>
          )}
        </Flex>
      )}
      {CustomEditor ? (
        CustomEditor
      ) : (
        <Editor
          language="sql"
          theme="vs"
          value={value}
          onChange={handleEditorChange}
          onMount={(editor, monaco) => {
            if (onRun) {
              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onRun);
            }

            if (onRunBase) {
              editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Enter, onRunBase);
            }

            if (onRunDiff) {
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
                onRunDiff,
              );
            }
          }}
          options={{
            tabSize: 2,
            fontSize: 16,
            lineNumbers: "on",
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: "on",
            wrappingIndent: "indent",
            // Additional options as needed
            ...options,
          }}
        />
      )}
    </>
  );
};

export const DualSqlEditor: React.FC<DualSqlEditorProps> = ({
  value,
  baseValue,
  onChange,
  onChangeBase,
  onRun,
  onRunBase,
  onRunDiff,
  options = {},
  labels,
  BaseEnvironmentSetupGuide,
  ...props
}: DualSqlEditorProps) => {
  const baseLabel = labels ? labels[0] : "Base";
  const currentLabel = labels ? labels[1] : "Current";
  return (
    <>
      <Flex height={"100%"} gap={0}>
        <Stack height={"100%"} width={"50%"} gap={0} borderRight={"1px"} borderColor={"#D4DBE4"}>
          <SqlEditor
            label={baseLabel}
            value={baseValue || ""}
            onChange={onChangeBase}
            onRunBase={onRunBase}
            options={options}
            CustomEditor={BaseEnvironmentSetupGuide ? BaseEnvironmentSetupGuide : undefined}
            {...props}
          />
        </Stack>
        <Stack height={"100%"} width={"50%"} gap={0}>
          <SqlEditor
            label={currentLabel}
            value={value}
            onChange={onChange}
            onRun={onRun}
            options={options}
            {...props}
          />
        </Stack>
      </Flex>
    </>
  );
};

export default SqlEditor;
