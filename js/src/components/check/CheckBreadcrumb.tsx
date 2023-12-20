import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Breadcrumb, BreadcrumbItem, Input } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";

interface CheckBreadcrumbProps {
  name: string;
  setName: (name: string) => void;
}

export function CheckBreadcrumb({ name, setName }: CheckBreadcrumbProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const editInputRef = useRef(null);

  const handleClick = () => {
    setEditValue(name);
    setIsEditing(true);
  };

  const handleCommit = useCallback(() => {
    setName(editValue);
    setIsEditing(false);
  }, [setName, setIsEditing, editValue]);

  const handleKeyDown: React.KeyboardEventHandler = (event) => {
    if (event.key === "Enter") {
      setName(editValue);
      setIsEditing(false);
    } else if (event.key === "Escape") {
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const handleChange: React.ChangeEventHandler = (event) => {
    setEditValue((event.target as any).value);
  };

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (
        editInputRef.current &&
        !(editInputRef.current as any).contains(event.target)
      ) {
        handleCommit();
      }
    };

    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, editInputRef, handleCommit]);

  return (
    <Breadcrumb
      flex="0 1"
      fontSize="12pt"
      fontWeight="500"
      separator={<ChevronRightIcon color="gray.500" />}
    >
      <BreadcrumbItem>
        <Box>Checklist</Box>
      </BreadcrumbItem>
      <BreadcrumbItem flex="0 1" cursor="pointer">
        {isEditing ? (
          <Input
            ref={editInputRef}
            value={editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            size="sm"
            w="auto"
            minW="200px"
            maxW="600px"
          />
        ) : (
          <Box
            onClick={handleClick}
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            overflow="hidden"
          >
            {name}
          </Box>
        )}
      </BreadcrumbItem>
    </Breadcrumb>
  );
}
