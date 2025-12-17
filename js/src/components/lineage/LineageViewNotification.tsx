import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import React, { useState } from "react";
import { IoClose } from "react-icons/io5";
import { sessionStorageKeys } from "@/lib/api/sessionStorageKeys";

interface NotificationProps {
  notification?: React.ReactNode;
  type: "info" | "success" | "warning" | "error";
}

export function LineageViewNotification({
  notification,
  type,
}: NotificationProps) {
  const notificationKey = sessionStorageKeys.lineageNotificationDismissed;

  // Initialize state from sessionStorage (lazy initialization)
  const [visible, setVisible] = useState(() => {
    const dismissed = sessionStorage.getItem(notificationKey);
    return dismissed !== "true";
  });

  if (notification === null || !visible) {
    return null;
  }

  const bgColor = {
    info: "iochmara.50",
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
        boxShadow: 2,
        border: "1px solid",
        borderColor: "neutral.200",
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
