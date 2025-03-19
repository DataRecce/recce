import { CopyIcon } from "@chakra-ui/icons";
import { Box, Flex, IconButton, useClipboard } from "@chakra-ui/react";
import { useState } from "react";

interface DiffTextProps {
  value: string;
  colorScheme: string;
  grayOut?: boolean;
  noCopy?: boolean;
  fontSize?: string;
}

export const DiffText = ({ value, colorScheme, grayOut, noCopy, fontSize }: DiffTextProps) => {
  const { onCopy, hasCopied } = useClipboard(value);
  const [isHovered, setIsHovered] = useState(false);

  const CopyControl = () => {
    if (noCopy || grayOut) {
      return <></>;
    }

    if (hasCopied) {
      return <>Copied</>;
    }

    if (!isHovered) {
      return <></>;
    }

    return (
      <IconButton
        aria-label="Copy"
        icon={<CopyIcon boxSize="10px" />}
        size="xs"
        minW="10px"
        h="10px"
        variant="unstyled"
        onClick={onCopy}
        display="flex"
        alignItems="center"
        justifyContent="center"
      />
    );
  };

  return (
    <Flex
      p="2px 5px"
      minWidth="30px"
      maxWidth="200px"
      overflow="hidden"
      textOverflow="ellipsis"
      color={`${colorScheme}.800`}
      backgroundColor={`${colorScheme}.100`}
      alignItems="center"
      gap="2px"
      rounded="md"
      fontSize={fontSize}
      flexShrink={noCopy ? "0" : "inherit"}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}>
      <Box overflow="hidden" textOverflow="ellipsis" color={grayOut ? "gray" : "inherit"}>
        {value}
      </Box>

      <CopyControl />
    </Flex>
  );
};
