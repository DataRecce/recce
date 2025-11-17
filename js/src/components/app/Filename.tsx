import {
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  Flex,
  Icon,
  IconButton,
  Input,
  Portal,
  useDisclosure,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import React, { useEffect, useRef, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from "@/components/ui/tooltip";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useChecks } from "@/lib/api/checks";
import { localStorageKeys } from "@/lib/api/localStorageKeys";
import { rename, saveAs } from "@/lib/api/state";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { IconEdit, IconSave } from "../icons";
import { formatRunDateTime } from "../run/RunStatusAndDate";

const useRecceToast = () => {
  const toastSuccess = (message: string) => {
    toaster.create({
      description: message,
      type: "success",
      duration: 5000,
      closable: true,
    });
  };

  const toastError = (message: string, error?: Error) => {
    let errorMessage = message;
    if (error != null) {
      if (error instanceof AxiosError) {
        errorMessage = `${message}. ${String((error as AxiosError<{ detail: string } | undefined, unknown>).response?.data?.detail)}`;
      } else {
        errorMessage = `${message}. ${error}`;
      }
    }

    toaster.create({
      description: errorMessage,
      type: "error",
      duration: 5000,
      closable: true,
    });
  };

  return { toastSuccess, toastError };
};

const useClosePrompt = (prompt: boolean) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    if (prompt) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      if (prompt) {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
    };
  }, [prompt]);
};

interface FilenameState {
  newFileName: string;
  errorMessage?: string;
  modified?: boolean;
  overwriteWithMethod?: "save" | "rename";
  bypass?: boolean;
}

export const Filename = () => {
  const { featureToggles } = useRecceInstanceContext();
  const { fileName, cloudMode, isDemoSite, envInfo } = useLineageGraphContext();
  const modalDisclosure = useDisclosure();
  const overwriteDisclosure = useDisclosure();
  const isStateless = !fileName && !cloudMode && !isDemoSite;
  const { data: checks } = useChecks(isStateless);
  const hasNonPresetChecks =
    checks != undefined &&
    checks.filter((check) => !check.is_preset).length > 0;
  useClosePrompt(isStateless && hasNonPresetChecks);

  const [
    { newFileName, errorMessage, modified, overwriteWithMethod, bypass },
    setState,
  ] = useState<FilenameState>({
    newFileName: fileName ?? "recce_state.json",
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const { toastSuccess, toastError } = useRecceToast();
  const queryClient = useQueryClient();

  const handleOpen = () => {
    setState({
      newFileName: fileName ?? "recce_state.json",
      modified: !fileName,
    });

    modalDisclosure.onOpen();
  };

  const handleAction = async (
    method: "save" | "rename",
    overwrite?: boolean,
  ) => {
    if (!newFileName) {
      return;
    }

    const bypassOverwrite =
      localStorage.getItem(localStorageKeys.bypassSaveOverwrite) === "true";

    try {
      if (method === "save") {
        await saveAs({
          filename: newFileName,
          overwrite: overwrite ?? bypassOverwrite,
        });
      } else {
        await rename({
          filename: newFileName,
          overwrite: overwrite ?? bypassOverwrite,
        });
      }
      toastSuccess(
        method === "save"
          ? "Save file successfully"
          : "Rename file successfully",
      );
      await queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
      if (bypass) {
        localStorage.setItem(localStorageKeys.bypassSaveOverwrite, "true");
      }
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 409) {
          setState((s) => ({
            ...s,
            overwriteWithMethod: method,
          }));

          overwriteDisclosure.onOpen();
          return;
        }
      }
      toastError(
        method === "save" ? "Save file failed" : "Rename file failed",
        error as Error,
      );
    } finally {
      modalDisclosure.onClose();
    }
  };

  const handleOvewriteBack = () => {
    overwriteDisclosure.onClose();
    modalDisclosure.onOpen();
    setState((s) => {
      return {
        ...s,
        overwriteWithMethod: undefined,
      };
    });
  };

  if (cloudMode || isDemoSite) {
    return <></>;
  }

  const titleNewInstance =
    "New Instance" + (hasNonPresetChecks ? " (unsaved)" : "");
  let titleReadOnlyState;
  if (featureToggles.disableSaveToFile && fileName) {
    const generatedAt = envInfo?.stateMetadata?.generated_at;
    const formattedDate = generatedAt
      ? formatRunDateTime(new Date(generatedAt))
      : null;
    titleReadOnlyState = formattedDate
      ? `${fileName} (${formattedDate})`
      : null;
  }

  return (
    <>
      <Flex justifyContent="center" alignItems="center">
        <Box fontWeight="600">
          {titleReadOnlyState ?? fileName ?? titleNewInstance}
        </Box>
        {!featureToggles.disableSaveToFile && (
          <Tooltip
            content={fileName ? "Change Filename" : "Save"}
            openDelay={1000}
          >
            <IconButton
              onClick={handleOpen}
              aria-label={fileName ? "Change Filename" : "Save"}
              variant="ghost"
              size="sm"
              colorPalette="gray"
            >
              <Icon
                as={fileName ? IconEdit : IconSave}
                boxSize={"16px"}
                verticalAlign="middle"
              />
            </IconButton>
          </Tooltip>
        )}
      </Flex>
      <Dialog.Root
        open={modalDisclosure.open}
        onOpenChange={modalDisclosure.onClose}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {fileName ? "Change Filename" : "Save File"}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <Field.Root invalid={!!errorMessage}>
                  <Field.Label>File name:</Field.Label>
                  <Input
                    ref={inputRef}
                    value={newFileName}
                    placeholder="Enter filename"
                    onChange={(e) => {
                      const value = e.target.value;
                      let newErrorMessage: string | undefined = undefined;

                      if (!value) {
                        newErrorMessage = "Filename cannot be empty.";
                      } else if (!value.endsWith(".json")) {
                        newErrorMessage = "Filename must end with .json.";
                      } else if (!/^[a-zA-Z0-9 _-]+\.json$/.test(value)) {
                        newErrorMessage =
                          "Invalid filename. Only alphanumeric, space, _ and - are allowed.";
                      } else if (fileName && value === fileName) {
                        newErrorMessage =
                          "Filename is the same as the current one.";
                      }

                      setState((s) => {
                        return {
                          ...s,
                          modified: true,
                          newFileName: value,
                          errorMessage: newErrorMessage,
                        };
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (errorMessage) {
                          return;
                        }

                        if (!fileName) {
                          void handleAction("save");
                        } else {
                          void handleAction("rename");
                        }
                      } else if (e.key === "Escape") {
                        modalDisclosure.onClose();
                      }
                    }}
                  />
                  <Field.ErrorText>{errorMessage}</Field.ErrorText>
                </Field.Root>
              </Dialog.Body>
              <Dialog.Footer gap="5px">
                <Button
                  size="sm"
                  colorPalette={fileName ? undefined : "blue"}
                  onClick={async () => {
                    await handleAction("save");
                  }}
                  disabled={!newFileName || !!errorMessage || !modified}
                >
                  {fileName ? "Save as New File" : "Confirm"}
                </Button>
                {fileName && (
                  <Button
                    size="sm"
                    colorPalette="blue"
                    onClick={async () => {
                      await handleAction("rename");
                    }}
                    disabled={!newFileName || !!errorMessage || !modified}
                  >
                    Rename
                  </Button>
                )}
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
      <Dialog.Root
        open={overwriteDisclosure.open}
        onOpenChange={overwriteDisclosure.onClose}
        initialFocusEl={() => {
          return inputRef.current;
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Overwrite File?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body
                borderTop="solid 1px lightgray"
                borderBottom="solid 1px lightgray"
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <Box fontSize="12pt">
                  {overwriteWithMethod === "save"
                    ? "Saving a file with this name will overwrite the existing file. Are you sure you wish to continue?"
                    : "Renaming the file with this name will overwrite the existing file. Are you sure you wish to continue?"}
                </Box>

                <Checkbox.Root
                  size="xs"
                  checked={bypass}
                  onCheckedChange={(e) => {
                    setState((s) => ({ ...s, bypass: Boolean(e.checked) }));
                  }}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control />
                  <Checkbox.Label fontWeight="bold" pt="8px">
                    Don&apos;t show this again
                  </Checkbox.Label>
                </Checkbox.Root>
              </Dialog.Body>
              <Dialog.Footer gap="5px">
                <Button
                  variant="outline"
                  onClick={handleOvewriteBack}
                  size="sm"
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  colorPalette="blue"
                  onClick={() => {
                    if (!overwriteWithMethod) {
                      return;
                    }

                    void handleAction(overwriteWithMethod, true);
                    overwriteDisclosure.onClose();
                  }}
                >
                  Overwrite
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
};
