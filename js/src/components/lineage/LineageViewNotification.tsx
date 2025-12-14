import React, { useState } from "react";
import { CloseButton, Flex, Spacer } from "@/components/ui/mui";
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
    success: "green.50",
    warning: "amber.50",
    error: "red.50",
  }[type];

  return (
    <Flex
      w="100%"
      direction="row"
      p="5px 10px"
      gap="5px"
      alignItems="flex-start"
      borderRadius="md"
      boxShadow="md"
      border="1px solid"
      borderColor="neutral.200"
      bg={bgColor}
    >
      {notification}
      <Spacer />
      <CloseButton
        onClick={() => {
          sessionStorage.setItem(notificationKey, "true");
          setVisible(false);
        }}
      />
    </Flex>
  );
}
