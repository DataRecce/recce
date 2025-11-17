import { Button, Flex, Spacer, Stack, Text } from "@chakra-ui/react";
import { Editor, EditorProps } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import React, { useEffect } from "react";
import { FaPlay } from "react-icons/fa6";
import { extractSchemas, formatTimeToNow } from "@/components/app/EnvInfo";
import { ManifestMetadata } from "@/lib/api/info";

import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";

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
  manifestData?: ManifestMetadata;
  schemas?: string;
  label?: string;
  CustomEditor?: React.ReactNode;
}

export interface DualSqlEditorProps extends SqlEditorProps {
  labels?: [string, string]; // [baseLabel, currentLabel]
  SetupGuide?: React.ReactNode;
}

function SqlEditor({
  value,
  onChange,
  onRun,
  onRunBase,
  onRunDiff,
  label,
  CustomEditor,
  options = {},
  manifestData,
  schemas,
  ...props
}: SqlEditorProps) {
  const { featureToggles } = useRecceInstanceContext();
  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && onChange) {
      onChange(value);
    }
  };
  let timestamp = "";
  if (manifestData) {
    timestamp = manifestData.generated_at
      ? formatTimeToNow(manifestData.generated_at)
      : "";
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Monaco editor has focus
      const monacoElement = document.querySelector(".monaco-editor");
      if (monacoElement?.contains(document.activeElement) && e.key === " ") {
        e.stopPropagation(); // Prevent other from capturing
      }
    };

    document.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  const handleMonacoSpaceBar = (
    editor: IStandaloneCodeEditor,
    monaco: typeof import("monaco-editor"),
  ) => {
    // Register space bar handling through Monaco's internal API
    editor.addCommand(
      monaco.KeyCode.Space,
      () => {
        // Explicitly trigger space insertion
        const position = editor.getPosition();
        if (position) {
          console.log("Inserting space at", position);
          editor.executeEdits("", [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
              text: " ",
              forceMoveMarkers: true,
            },
          ]);
        }
      },
      "!suggestWidgetVisible && !findWidgetVisible", // Context key expression
    );
  };

  return (
    <>
      {(label ?? onRun ?? onRunBase) && (
        <Flex
          backgroundColor="#EDF2F880"
          height="40px"
          minH="40px"
          fontSize={"14px"}
          align="center"
          margin={"0"}
          padding={"0px 16px"}
          flex="0 0 40px"
        >
          <Text as="strong" className="no-track-pii-safe">
            {label ? label.toUpperCase() : ""}
          </Text>
          {manifestData && (
            <span className="ml-1">
              (
              {schemas && (
                <span className="no-track-pii-safe">{schemas}, </span>
              )}
              <span>{timestamp}</span>)
            </span>
          )}

          <Spacer />
          {(onRun ?? onRunBase) && (
            <Button
              size="xs"
              variant="outline"
              onClick={onRun ?? onRunBase}
              backgroundColor={"white"}
              padding={"6px 12px"}
              disabled={featureToggles.disableDatabaseQuery}
            >
              <FaPlay /> Run Query
            </Button>
          )}
        </Flex>
      )}
      {CustomEditor ?? (
        <Editor
          className="no-track-pii-safe"
          language="sql"
          theme="vs"
          value={value}
          onChange={handleEditorChange}
          onMount={(editor, monaco) => {
            handleMonacoSpaceBar(editor, monaco);

            if (onRun) {
              editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                onRun,
              );
            }

            if (onRunBase) {
              editor.addCommand(
                monaco.KeyMod.Alt | monaco.KeyCode.Enter,
                onRunBase,
              );
            }

            if (onRunDiff) {
              editor.addCommand(
                monaco.KeyMod.CtrlCmd |
                  monaco.KeyMod.Shift |
                  monaco.KeyCode.Enter,
                onRunDiff,
              );
            }
          }}
          options={{
            domReadOnly: false,
            readOnly: false,
            extraEditorClassName: "no-track-pii-safe max-h-dvh",
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
}

export function DualSqlEditor({
  value,
  baseValue,
  onChange,
  onChangeBase,
  onRun,
  onRunBase,
  onRunDiff,
  options = {},
  labels,
  SetupGuide,
  ...props
}: DualSqlEditorProps) {
  const baseLabel = labels ? labels[0] : "Base";
  const currentLabel = labels ? labels[1] : "Current";
  const { envInfo, lineageGraph } = useLineageGraphContext();

  let dbtBase: ManifestMetadata | undefined;
  let dbtCurrent: ManifestMetadata | undefined;
  if (envInfo?.dbt?.base && envInfo.dbt.current) {
    dbtBase = envInfo.dbt.base;
    dbtCurrent = envInfo.dbt.current;
  }

  const [baseSchemas, currentSchemas] = extractSchemas(lineageGraph);

  return (
    <>
      <Flex height={"100%"} gap={0}>
        <Stack
          height={"100%"}
          width={"50%"}
          gap={0}
          borderRight={"1px"}
          borderColor={"#D4DBE4"}
        >
          <SqlEditor
            label={baseLabel}
            value={baseValue ?? ""}
            onChange={onChangeBase}
            onRunBase={onRunBase}
            options={options}
            CustomEditor={SetupGuide}
            manifestData={dbtBase ?? undefined}
            schemas={Array.from(baseSchemas).join(", ")}
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
            manifestData={dbtCurrent ?? undefined}
            schemas={Array.from(currentSchemas).join(", ")}
            {...props}
          />
        </Stack>
      </Flex>
    </>
  );
}

export default SqlEditor;
