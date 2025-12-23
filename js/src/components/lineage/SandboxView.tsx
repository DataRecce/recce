import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MuiDialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { alpha, useTheme } from "@mui/material/styles";
import MuiTooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import React, { useState } from "react";
import { AiOutlineExperiment } from "react-icons/ai";
import { IoClose } from "react-icons/io5";
import { VscFeedback } from "react-icons/vsc";
import { DiffEditor } from "@/components/editor";
import { colors } from "@/components/ui/mui-theme";
import { QueryParams, submitQueryDiff } from "@/lib/api/adhocQuery";
import { NodeData } from "@/lib/api/info";
import { localStorageKeys } from "@/lib/api/localStorageKeys";
import { SubmitOptions, waitRun } from "@/lib/api/runs";
import {
  trackPreviewChange,
  trackPreviewChangeFeedback,
  trackSingleEnvironment,
} from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceQueryContext } from "@/lib/hooks/RecceQueryContext";
import { useFeedbackCollectionToast } from "@/lib/hooks/useFeedbackCollectionToast";
import { useGuideToast } from "@/lib/hooks/useGuideToast";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import { formatTimestamp } from "../app/EnvInfo";
import { QueryForm } from "../query/QueryForm";
import { RunResultPane } from "../run/RunResultPane";
import { VSplit } from "../split/Split";

interface SandboxViewProps {
  isOpen: boolean;
  onClose: () => void;
  current?: NodeData;
  height?: string;
}

function SandboxTopBar({
  current,
  primaryKeys,
  setPrimaryKeys,
  onRunResultOpen,
  runQuery,
  isPending,
}: {
  current?: NodeData;
  primaryKeys: string[];
  setPrimaryKeys: (primaryKeys: string[]) => void;
  onRunResultOpen: () => void;
  runQuery: () => void;
  isPending: boolean;
}) {
  return (
    <Stack
      direction="row"
      justifyContent="flex-end"
      alignItems="center"
      sx={{
        p: "4pt 8pt",
        gap: "5px",
        height: "54px",
        borderBottom: "1px solid",
        borderBottomColor: "divider",
        flex: "0 0 54px",
      }}
    >
      <Box>
        <Typography
          variant="h6"
          component="h2"
          sx={{ display: "flex", alignItems: "center", gap: "5px" }}
        >
          <Box component={AiOutlineExperiment} sx={{ fontSize: "1.2em" }} />
          Sandbox
        </Typography>
        <Typography sx={{ fontSize: "0.75rem", color: "grey.500" }}>
          Compare the run results based on the modified SQL code of model{" "}
          <b>{current?.name}</b>
        </Typography>
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      <QueryForm
        defaultPrimaryKeys={primaryKeys}
        onPrimaryKeysChange={setPrimaryKeys}
      />
      <MuiTooltip title="Run diff to see the changes">
        <Button
          size="small"
          sx={{ mt: "16px", fontSize: "14px" }}
          onClick={() => {
            onRunResultOpen();
            runQuery();
          }}
          color="iochmara"
          variant="contained"
          disabled={isPending}
        >
          {isPending ? "Running..." : "Run Diff"}
        </Button>
      </MuiTooltip>
    </Stack>
  );
}
function SandboxEditorLabels({
  currentModelID,
  height = "32px",
  flex = "0 0 auto",
}: {
  currentModelID: string;
  height?: string;
  flex?: string;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { lineageGraph, envInfo } = useLineageGraphContext();
  const widthOfBar = "50%";
  const margin = "0 16px";

  const currentTime = formatTimestamp(
    envInfo?.dbt?.current?.generated_at ?? "",
  );
  const latestUpdateDistanceToNow = formatDistanceToNow(currentTime, {
    addSuffix: true,
  });
  let schema = "N/A";
  if (lineageGraph?.nodes[currentModelID]) {
    const value = lineageGraph.nodes[currentModelID];
    if (value.data.data.current?.schema) {
      schema = value.data.data.current.schema;
    }
  }

  return (
    <Stack
      direction="row"
      sx={{
        gap: 0,
        height,
        flex,
        fontSize: "14px",
        alignItems: "center",
        m: 0,
        bgcolor: isDark
          ? alpha(colors.neutral[700], 0.5)
          : alpha(colors.neutral[100], 0.5),
      }}
    >
      <Stack sx={{ width: widthOfBar }}>
        <Typography sx={{ fontWeight: "bold", margin }}>
          ORIGINAL (Schema: {schema}, Last Updated: {latestUpdateDistanceToNow})
        </Typography>
      </Stack>
      <Stack sx={{ width: widthOfBar }}>
        <Typography sx={{ fontWeight: "bold", margin }}>
          SANDBOX EDITOR
        </Typography>
      </Stack>
    </Stack>
  );
}

interface SqlPreviewProps {
  current?: NodeData;
  onChange: (value: string) => void;
}

function SqlPreview({ current, onChange }: SqlPreviewProps) {
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  return (
    <DiffEditor
      original={current?.raw_code ?? ""}
      modified={current?.raw_code ?? ""}
      language="sql"
      readOnly={false}
      lineNumbers={true}
      sideBySide={true}
      theme={isDark ? "dark" : "light"}
      height="100%"
      onModifiedChange={onChange}
    />
  );
}

export function SandboxView({ isOpen, onClose, current }: SandboxViewProps) {
  const [isRunResultOpen, setIsRunResultOpen] = useState(false);
  const [modifiedCode, setModifiedCode] = useState<string>(
    current?.raw_code ?? "",
  );
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const { showRunId, clearRunResult } = useRecceActionContext();
  const { primaryKeys, setPrimaryKeys } = useRecceQueryContext();
  const { data: flags, isLoading } = useRecceServerFlag();

  const queryFn = async () => {
    const sqlTemplate = modifiedCode;
    const runFn = submitQueryDiff;
    const params: QueryParams = {
      current_model: current?.name ?? "",
      primary_keys: primaryKeys,
      sql_template: sqlTemplate,
    };
    const options: SubmitOptions = { nowait: true };

    const { run_id } = await runFn(params, options);

    showRunId(run_id);

    return await waitRun(run_id);
  };

  const { mutate: runQuery, isPending } = useMutation({
    mutationFn: queryFn,
    onSuccess(data) {
      if (data.error) {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "failure",
        });
      } else {
        trackPreviewChange({
          action: "run",
          node: current?.name,
          status: "success",
        });
        setTimeout(() => {
          feedbackToast();
        }, 1000);
        if (!isLoading && flags?.single_env_onboarding) {
          setTimeout(() => {
            prepareEnvToast();
          }, 2000);
        }
      }
    },
  });

  const { feedbackToast, closeToast } = useFeedbackCollectionToast({
    feedbackId: localStorageKeys.previewChangeFeedbackID,
    description: "Enjoy preview change?",

    onFeedbackSubmit: (feedback: string) => {
      switch (feedback) {
        case "like":
          trackPreviewChangeFeedback({ feedback: "like", node: current?.name });
          break;
        case "dislike":
          trackPreviewChangeFeedback({
            feedback: "dislike",
            node: current?.name,
          });
          break;
        case "link":
          trackPreviewChangeFeedback({ feedback: "form", node: current?.name });
          break;
        default:
          console.log("Not support feedback type");
      }
    },
    externalLink:
      "https://docs.google.com/forms/d/e/1FAIpQLSd7Lei7Ijwo7MinWaI0K6rzZi_21gV1BKetmiNEX254kDziDA/viewform?usp=header",
    externalLinkText: "Give us feedback",
  });

  const { guideToast: prepareEnvToast, closeGuideToast } = useGuideToast({
    guideId: localStorageKeys.prepareEnvGuideID,
    description: "Want to compare data changes with production data?",
    externalLink:
      "https://docs.datarecce.io/get-started/#prepare-dbt-artifacts",
    externalLinkText: "Learn how.",
    onExternalLinkClick: () => {
      trackSingleEnvironment({
        action: "external_link",
        from: "preview_changes",
        node: current?.name,
      });
    },
  });

  // Reset modifiedCode when modal opens (during render)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      // Modal just opened, reset to original code
      setModifiedCode(current?.raw_code ?? "");
    }
  }

  const handleClose = () => {
    onClose();
    setIsRunResultOpen(false);
    clearRunResult();
    closeToast();
    closeGuideToast();
    trackPreviewChange({ action: "close", node: current?.name });
  };

  return (
    <MuiDialog
      open={isOpen}
      onClose={handleClose}
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            m: 0,
          },
        },
      }}
    >
      <Box
        sx={{
          height: "40px",
          bgcolor: "cyan.600",
          px: 0,
          py: 2,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          sx={{ height: "100%", gap: "10px" }}
        >
          <Box
            component="img"
            sx={{ width: "20px", height: "20px", ml: "18px" }}
            src="/logo/recce-logo-white.png"
            alt="recce-logo-white"
          />
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontFamily: '"Montserrat", sans-serif',
              fontSize: "1.125rem",
              color: "common.white",
            }}
          >
            RECCE
          </Typography>
          <Chip
            label="Experiment"
            size="small"
            variant="outlined"
            sx={{
              fontSize: "0.875rem",
              color: "common.white",
              borderColor: "rgba(255,255,255,0.5)",
            }}
          />
        </Stack>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 4,
            color: "common.white",
          }}
        >
          <IoClose />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0 }}>
        <VSplit
          sizes={isRunResultOpen ? [50, 50] : [100, 0]}
          minSize={isRunResultOpen ? 100 : 0}
          gutterSize={isRunResultOpen ? 5 : 0}
          style={{
            flex: "1",
            contain: "size",
            height: "100%",
          }}
        >
          <Stack sx={{ height: "100%", m: 0, p: 0 }}>
            <SandboxTopBar
              current={current}
              primaryKeys={primaryKeys ?? []}
              setPrimaryKeys={setPrimaryKeys}
              onRunResultOpen={() => setIsRunResultOpen(true)}
              runQuery={runQuery}
              isPending={isPending}
            />
            <SandboxEditorLabels
              height="32px"
              flex="0 0 auto"
              currentModelID={current?.id ?? ""}
            />
            <SqlPreview current={current} onChange={setModifiedCode} />
          </Stack>
          {isRunResultOpen ? (
            <RunResultPane
              onClose={() => setIsRunResultOpen(false)}
              disableAddToChecklist
            />
          ) : (
            <Box></Box>
          )}
        </VSplit>
      </DialogContent>
      {/* Fixed position button */}
      <Box sx={{ position: "fixed", bottom: 16, right: 16, opacity: 0.5 }}>
        <MuiTooltip title="Give us feedback">
          <IconButton
            aria-label="feedback"
            size="medium"
            onClick={() => {
              feedbackToast(true);
            }}
          >
            <VscFeedback />
          </IconButton>
        </MuiTooltip>
      </Box>
    </MuiDialog>
  );
}
