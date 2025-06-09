import React, { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Box, Breadcrumb, BreadcrumbItem, Input } from "@chakra-ui/react";
import { ChevronRightIcon } from "@chakra-ui/icons";

interface CheckBreadcrumbProps {
  name: string;
  setName: (name: string) => void;
}

export function CheckBreadcrumb({ name, setName }: CheckBreadcrumbProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  const handleChange: React.ChangeEventHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setEditValue(event.target.value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editInputRef.current && !editInputRef.current.contains(event.target as Node | null)) {
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
      flex="0 1 auto"
      fontSize="12pt"
      fontWeight="500"
      className="no-track-pii-safe"
      separator={<ChevronRightIcon color="gray.500" />}
      overflow={"hidden"}>
      <BreadcrumbItem cursor="pointer" flex="0 1 auto" overflow="hidden">
        {isEditing ? (
          <Input
            ref={editInputRef}
            value={editValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            size="sm"
            w="100%"
          />
        ) : (
          <Box
            flex="0 1 auto"
            onClick={handleClick}
            textOverflow="ellipsis"
            whiteSpace="nowrap"
            overflow="hidden">
            {name}
          </Box>
        )}
      </BreadcrumbItem>
    </Breadcrumb>
  );
}
