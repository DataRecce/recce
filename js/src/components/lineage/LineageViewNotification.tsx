import { sessionStorageKeys } from "@/lib/api/sessionStorageKeys";
import { CloseButton, Flex, Spacer } from "@chakra-ui/react";
import React, { useEffect, useState } from "react";

interface NotificationProps {
  notification?: React.ReactNode;
  type: "info" | "success" | "warning" | "error";
}

export function LineageViewNotification({ notification, type }: NotificationProps) {
  const notificationKey = sessionStorageKeys.lineageNotificationDismissed;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(notificationKey);
    if (dismissed === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
    }
  }, [notificationKey]);

  if (notification === null || !visible) {
    return null;
  }

  const bgColor = {
    info: "blue.50",
    success: "green.50",
    warning: "yellow.50",
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
      borderColor="gray.200"
      bg={bgColor}>
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
