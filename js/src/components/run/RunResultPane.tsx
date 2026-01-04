import { useRecceInstanceContext } from "@datarecce/ui/contexts";
import { useIsDark } from "@datarecce/ui/hooks";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { type MouseEvent, ReactNode, Ref, useCallback, useState } from "react";
import { IoClose } from "react-icons/io5";
import { PiCaretDown, PiCheck, PiCopy, PiRepeat } from "react-icons/pi";
import { TbCloudUpload } from "react-icons/tb";
import YAML from "yaml";
import AuthModal from "@/components/AuthModal/AuthModal";
import { CodeEditor } from "@/components/editor";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { createCheckByRun } from "@/lib/api/checks";
import { trackCopyToClipboard, trackShareState } from "@/lib/api/track";
import {
  AxiosQueryParams,
  isQueryBaseRun,
  isQueryDiffRun,
  isQueryRun,
  RunParamTypes,
} from "@/lib/api/types";
import { useApiConfig } from "@/lib/hooks/ApiConfigContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionAdapter";
import { useRecceShareStateContext } from "@/lib/hooks/RecceShareStateContext";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";
import { useAppLocation } from "@/lib/hooks/useAppRouter";
import { useRun } from "@/lib/hooks/useRun";
import {
  LearnHowLink,
  RecceNotification,
} from "../onboarding-guide/Notification";
import SqlEditor, { DualSqlEditor } from "../query/SqlEditor";
import { RunStatusAndDate } from "./RunStatusAndDate";
import { RunView } from "./RunView";
import {
  findByRunType,
  RefTypes,
  RegistryEntry,
  runTypeHasRef,
  ViewOptionTypes,
} from "./registry";

interface RunPageProps {
  onClose?: () => void;
  disableAddToChecklist?: boolean;
  isSingleEnvironment?: boolean;
}

const _ParamView = (data: { type: string; params: RunParamTypes }) => {
  const isDark = useIsDark();
  const yaml = YAML.stringify(data, null, 2);
  return (
    <CodeEditor
      value={yaml}
      language="yaml"
      readOnly={true}
      lineNumbers={false}
      wordWrap={true}
      fontSize={14}
      height="100%"
      theme={isDark ? "dark" : "light"}
      className="no-track-pii-safe"
    />
  );
};

const SingleEnvironmentSetupNotification = ({
  runType,
}: {
  runType?: string;
}) => {
  const [open, setOpen] = useState(true);

  if (!open) {
    return <></>;
  }

  const handleClose = () => setOpen(false);
  switch (runType) {
    case "row_count":
      return (
        <RecceNotification onClose={handleClose}>
          <Typography>
            Enable row count diffing, and other Recce features, by configuring a
            base dbt environment to compare against. <LearnHowLink />
          </Typography>
        </RecceNotification>
      );
    case "profile":
      return (
        <RecceNotification onClose={handleClose}>
          <Typography>
            Enable data-profile diffing, and other Recce features, by
            configuring a base dbt environment to compare against.{" "}
            <LearnHowLink />
          </Typography>
        </RecceNotification>
      );
    default:
      return <></>;
  }
};

const RunResultShareMenu = ({
  disableCopyToClipboard,
  onCopyToClipboard,
  onMouseEnter,
  onMouseLeave,
}: {
  disableCopyToClipboard: boolean;
  onCopyToClipboard: () => Promise<void>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => {
  const { authed } = useRecceInstanceContext();
  const { handleShareClick } = useRecceShareStateContext();
  const [showModal, setShowModal] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="neutral"
        onClick={handleClick}
        endIcon={<PiCaretDown />}
        sx={{ textTransform: "none" }}
      >
        Share
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem
          onClick={async () => {
            await onCopyToClipboard();
            handleClose();
          }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          disabled={disableCopyToClipboard}
        >
          <ListItemIcon>
            <PiCopy />
          </ListItemIcon>
          <ListItemText>Copy to Clipboard</ListItemText>
        </MenuItem>
        <Divider />
        {authed ? (
          <MenuItem
            onClick={async () => {
              await handleShareClick();
              trackShareState({ name: "create" });
              handleClose();
            }}
          >
            <ListItemIcon>
              <TbCloudUpload />
            </ListItemIcon>
            <ListItemText>Share to Cloud</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setShowModal(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <TbCloudUpload />
            </ListItemIcon>
            <ListItemText>Share</ListItemText>
          </MenuItem>
        )}
      </Menu>
      {showModal && (
        <AuthModal
          parentOpen={showModal}
          handleParentClose={setShowModal}
          ignoreCookie
          variant="enable-share"
        />
      )}
    </>
  );
};

type TabValueItems = "result" | "params" | "query";

export const PrivateLoadableRunView = ({
  runId,
  onClose,
  isSingleEnvironment,
}: {
  runId?: string;
  onClose?: () => void;
  isSingleEnvironment?: boolean;
}) => {
  const { featureToggles } = useRecceInstanceContext();
  const { runAction } = useRecceActionContext();
  const { error, run, onCancel, isRunning } = useRun(runId);
  const [viewOptions, setViewOptions] = useState<ViewOptionTypes>();
  const [tabValue, setTabValue] = useState<TabValueItems>("result");
  const _disableAddToChecklist = isSingleEnvironment;
  const showSingleEnvironmentSetupNotification = isSingleEnvironment;

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  const handleRerun = useCallback(() => {
    if (run) {
      runAction(run.type, run.params as unknown as AxiosQueryParams);
    }
  }, [run, runAction]);

  const isQuery =
    run?.type === "query" ||
    run?.type === "query_diff" ||
    run?.type === "query_base";
  const { ref, onCopyToClipboard, onMouseEnter, onMouseLeave } =
    useCopyToClipboardButton();
  const disableCopyToClipboard =
    !runId || !run?.result || !!error || tabValue !== "result";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showSingleEnvironmentSetupNotification && (
        <SingleEnvironmentSetupNotification runType={run?.type} />
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          borderBottom: 1,
          borderColor: "divider",
          mb: "1px",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue as TabValueItems)}
        >
          <Tab label="Result" value="result" />
          <Tab label="Params" value="params" />
          {isQuery && <Tab label="Query" value="query" />}
        </Tabs>
        <Box sx={{ flexGrow: 1 }} />
        <Stack
          direction="row"
          spacing={1}
          sx={{ overflow: "hidden", pr: 1 }}
          alignItems="center"
        >
          {run && <RunStatusAndDate run={run} />}
          <Button
            variant="outlined"
            color="neutral"
            disabled={
              !runId || isRunning || featureToggles.disableDatabaseQuery
            }
            size="small"
            onClick={handleRerun}
            startIcon={<PiRepeat />}
            sx={{ textTransform: "none" }}
          >
            Rerun
          </Button>
          {featureToggles.disableShare ? (
            <Button
              variant="outlined"
              color="neutral"
              disabled={
                !runId || !run?.result || !!error || tabValue !== "result"
              }
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              size="small"
              onClick={onCopyToClipboard}
              startIcon={<PiCopy />}
              sx={{ textTransform: "none" }}
            >
              Copy to Clipboard
            </Button>
          ) : (
            <RunResultShareMenu
              disableCopyToClipboard={disableCopyToClipboard}
              onCopyToClipboard={async () => {
                await onCopyToClipboard();
                trackCopyToClipboard({
                  type: run?.type ?? "unknown",
                  from: "run",
                });
              }}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
          )}

          <AddToCheckButton
            runId={runId}
            viewOptions={viewOptions as Record<string, unknown>}
          />

          <IconButton
            size="small"
            onClick={() => {
              if (onClose) {
                onClose();
              }
            }}
          >
            <IoClose />
          </IconButton>
        </Stack>
      </Box>
      {tabValue === "result" && (
        <RunView
          ref={ref as unknown as Ref<RefTypes>}
          error={error}
          run={run}
          onCancel={onCancel}
          viewOptions={viewOptions}
          onViewOptionsChanged={setViewOptions}
          RunResultView={RunResultView}
        />
      )}

      {tabValue === "params" && run && (
        <_ParamView type={run.type} params={run.params} />
      )}

      {tabValue === "query" &&
        run &&
        run.params &&
        (isQueryRun(run) || isQueryBaseRun(run) || isQueryDiffRun(run)) &&
        (isQueryDiffRun(run) ? (
          <DualSqlEditor
            value={run.params.sql_template}
            baseValue={run.params.base_sql_template}
            options={{ readOnly: true }}
          />
        ) : (
          <SqlEditor
            value={run.params.sql_template}
            options={{ readOnly: true }}
          />
        ))}
    </Box>
  );
};

export const RunResultPane = ({
  onClose,
  isSingleEnvironment,
}: RunPageProps) => {
  const { runId } = useRecceActionContext();

  return (
    <PrivateLoadableRunView
      runId={runId}
      onClose={onClose}
      isSingleEnvironment={isSingleEnvironment}
    />
  );
};

interface AddToCheckButtonProps {
  runId?: string;
  viewOptions: Record<string, unknown>;
}

function AddToCheckButton({
  runId,
  viewOptions,
}: AddToCheckButtonProps): ReactNode {
  const { featureToggles } = useRecceInstanceContext();
  const { error, run } = useRun(runId);
  const queryClient = useQueryClient();
  const [, setLocation] = useAppLocation();
  const { apiClient } = useApiConfig();

  const checkId = run?.check_id;

  const handleGoToCheck = useCallback(() => {
    if (!checkId) {
      return;
    }

    setLocation(`/checks/?id=${checkId}`);
  }, [checkId, setLocation]);

  const handleAddToChecklist = useCallback(async () => {
    if (!runId) {
      return;
    }
    const check = await createCheckByRun(runId, viewOptions, apiClient);

    await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/?id=${check.check_id}`);
  }, [runId, setLocation, queryClient, viewOptions, apiClient]);

  if (featureToggles.disableUpdateChecklist) {
    return <></>;
  }
  if (run?.check_id) {
    return (
      <Button
        disabled={!runId || !run.result || !!error}
        size="small"
        variant="contained"
        onClick={handleGoToCheck}
        startIcon={<PiCheck />}
        sx={{ textTransform: "none" }}
      >
        Go to Check
      </Button>
    );
  }
  return (
    <Button
      disabled={!runId || !run?.result || !!error}
      size="small"
      variant="contained"
      onClick={handleAddToChecklist}
      startIcon={<PiCheck />}
      sx={{ textTransform: "none" }}
    >
      Add to Checklist
    </Button>
  );
}
