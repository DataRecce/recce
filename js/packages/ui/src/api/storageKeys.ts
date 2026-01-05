"use client";

const localPrefix = "recce-";

export const LOCAL_STORAGE_KEYS = {
  bypassSaveOverwrite: `${localPrefix}-bypass-save-overwrite`,
  previewChangeFeedbackID: `${localPrefix}-preview-change-feedback`,
  prepareEnvGuideID: `${localPrefix}-prepare-env`,
};

const sessionPrefix = "recce";

export const SESSION_STORAGE_KEYS = {
  recommendationIgnored: `${sessionPrefix}-recommendation-ignored`,
  recommendationShowed: `${sessionPrefix}-recommendation-showed`,
  prevRefreshTimeStamp: `${sessionPrefix}-prev-refresh-timestamp`,
  lineageNotificationDismissed: `${sessionPrefix}-lineage-notification-dismissed`,
};
