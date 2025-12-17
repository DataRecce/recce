import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import React, { useMemo } from "react";
import { FaPlay } from "react-icons/fa6";
import { extractSchemas, formatTimeToNow } from "@/components/app/EnvInfo";
import { CodeEditor } from "@/components/editor";
import { ManifestMetadata } from "@/lib/api/info";
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
  options?: {
    readOnly?: boolean;
    fontSize?: number;
    lineNumbers?: "on" | "off";
    wordWrap?: "on" | "off";
  };
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

  const handleEditorChange = (value: string) => {
    if (onChange) {
      onChange(value);
    }
  };
  let timestamp = "";
  if (manifestData) {
    timestamp = manifestData.generated_at
      ? formatTimeToNow(manifestData.generated_at)
      : "";
  }

  // Convert keyboard shortcuts to CodeMirror format
  const keyBindings = useMemo(() => {
    const bindings = [];

    if (onRun) {
      bindings.push({
        key: "Mod-Enter", // Ctrl/Cmd + Enter
        run: () => {
          onRun();
          return true;
        },
      });
    }

    if (onRunBase) {
      bindings.push({
        key: "Alt-Enter",
        run: () => {
          onRunBase();
          return true;
        },
      });
    }

    if (onRunDiff) {
      bindings.push({
        key: "Mod-Shift-Enter", // Ctrl/Cmd + Shift + Enter
        run: () => {
          onRunDiff();
          return true;
        },
      });
    }

    return bindings;
  }, [onRun, onRunBase, onRunDiff]);

  // ... header rendering stays the same ...

  return (
    <>
      {(label ?? onRun ?? onRunBase) && (
        <Stack
          direction="row"
          sx={{
            bgcolor: "#EDF2F880",
            height: "40px",
            minHeight: "40px",
            fontSize: "14px",
            alignItems: "center",
            m: 0,
            p: "0px 16px",
            flex: "0 0 40px",
          }}
        >
          <Typography
            component="strong"
            sx={{ fontWeight: "bold" }}
            className="no-track-pii-safe"
          >
            {label ? label.toUpperCase() : ""}
          </Typography>
          {manifestData && (
            <span className="ml-1">
              (
              {schemas && (
                <span className="no-track-pii-safe">{schemas}, </span>
              )}
              <span>{timestamp}</span>)
            </span>
          )}

          <Box sx={{ flexGrow: 1 }} />
          {(onRun ?? onRunBase) && (
            <Button
              size="small"
              variant="outlined"
              onClick={onRun ?? onRunBase}
              sx={{ bgcolor: "white", p: "6px 12px" }}
              disabled={featureToggles.disableDatabaseQuery}
              startIcon={<FaPlay />}
            >
              Run Query
            </Button>
          )}
        </Stack>
      )}
      {CustomEditor ?? (
        <CodeEditor
          value={value}
          onChange={handleEditorChange}
          language="sql"
          readOnly={options.readOnly ?? false}
          lineNumbers={options.lineNumbers !== "off"}
          wordWrap={options.wordWrap !== "off"}
          fontSize={options.fontSize ?? 16}
          keyBindings={keyBindings}
          className="no-track-pii-safe max-h-dvh h-full"
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
      <Stack direction="row" sx={{ height: "100%", gap: 0 }}>
        <Stack
          sx={{
            height: "100%",
            width: "50%",
            gap: 0,
            borderRight: "1px solid #D4DBE4",
          }}
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
        <Stack sx={{ height: "100%", width: "50%", gap: 0 }}>
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
      </Stack>
    </>
  );
}

export default SqlEditor;
