import { Flex, Text, Stack, Badge, Spacer, IconButton } from "@chakra-ui/react";
import { EditorProps, DiffEditor, Editor } from "@monaco-editor/react";
import { on } from "events";
import { VscDebugStart } from "react-icons/vsc";

interface SqlEditorProps {
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
}

const SqlEditor: React.FC<SqlEditorProps> = ({
  value,
  onChange,
  onRun,
  onRunBase,
  onRunDiff,
  label,
  options = {},
  ...props
}: SqlEditorProps) => {
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && onChange) {
      onChange(value);
    }
  };

  const runButtonTitle = label ? `Run ${label}` : "Run";

  return (
    <>
      {(label || onRun || onRunBase) && (
        <Flex
          backgroundColor="#E8EFF5"
          height="18px"
          fontSize={"12px"}
          marginBottom={"6px"}
          paddingX="2"
        >
          <Text as="b">{label ? label.toUpperCase() : ""}</Text>
          <Spacer />
          {(onRun || onRunBase) && (
            <IconButton
              borderRadius={"2px"}
              aria-label="Run"
              icon={<VscDebugStart />}
              onClick={onRun || onRunBase}
              color="green"
              fontSize="18px"
              size="18px"
              marginX={2}
              title={runButtonTitle}
            />
          )}
        </Flex>
      )}
      <Editor
        language="sql"
        theme="vs"
        value={value}
        onChange={handleEditorChange}
        onMount={(editor, monaco) => {
          if (onRun) {
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
              onRun
            );
          }

          if (onRunBase) {
            editor.addCommand(
              monaco.KeyMod.Alt | monaco.KeyCode.Enter,
              onRunBase
            );
          }

          if (onRunDiff) {
            editor.addCommand(
              monaco.KeyMod.CtrlCmd |
                monaco.KeyMod.Shift |
                monaco.KeyCode.Enter,
              onRunDiff
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
    </>
  );
};

export const DualSqlEditor: React.FC<SqlEditorProps> = ({
  value,
  baseValue,
  onChange,
  onChangeBase,
  onRun,
  onRunBase,
  onRunDiff,
  options = {},
  ...props
}: SqlEditorProps) => {
  return (
    <>
      <Flex height={"100%"}>
        <Stack height={"100%"} width={"50%"}>
          <SqlEditor
            label="Current"
            value={value}
            onChange={onChange}
            onRun={onRun}
            options={options}
            {...props}
          />
        </Stack>
        <Stack height={"100%"} width={"50%"}>
          <SqlEditor
            label="Base"
            value={baseValue || ""}
            onChange={onChangeBase}
            onRunBase={onRunBase}
            options={options}
            {...props}
          />
        </Stack>
      </Flex>
    </>
  );
};

export default SqlEditor;
