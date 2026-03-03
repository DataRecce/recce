"use client";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { SESSION_STORAGE_KEYS } from "../../api";

export interface NotificationProps {
  notification?: React.ReactNode;
  type: "info" | "success" | "warning" | "error";
}

export function LineageViewNotification({
  notification,
  type,
}: NotificationProps) {
  const notificationKey = SESSION_STORAGE_KEYS.lineageNotificationDismissed;

  // Initialize state from sessionStorage (lazy initialization)
  const [visible, setVisible] = useState(() => {
    const dismissed = sessionStorage.getItem(notificationKey);
    return dismissed !== "true";
  });

  if (notification === null || !visible) {
    return null;
  }

  const bgColor = {
    info: "iochmara.light",
    success: "success.light",
    warning: "warning.light",
    error: "error.light",
  }[type];

  return (
    <Box
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "row",
        p: "5px 10px",
        gap: "5px",
        alignItems: "flex-start",
        borderRadius: 1,
        boxShadow: 4,
        border: "1px solid",
        borderColor: "neutral.light",
        bgcolor: bgColor,
      }}
    >
      {notification}
      <Box sx={{ flex: 1 }} />
      <IconButton
        size="small"
        onClick={() => {
          sessionStorage.setItem(notificationKey, "true");
          setVisible(false);
        }}
      >
        <IoClose />
      </IconButton>
    </Box>
  );
}
