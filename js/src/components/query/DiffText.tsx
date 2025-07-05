import { Box, Flex, IconButton } from "@chakra-ui/react";
import { useState } from "react";
import { useCopyToClipboard } from "usehooks-ts";
import { PiCopy } from "react-icons/pi";

interface DiffTextProps {
  value: string;
  colorScheme: string;
  grayOut?: boolean;
  noCopy?: boolean;
  fontSize?: string;
}

export const DiffText = ({ value, colorScheme, grayOut, noCopy, fontSize }: DiffTextProps) => {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const hasCopiedText = Boolean(copiedText);
  const [isHovered, setIsHovered] = useState(false);

  const CopyControl = () => {
    if (noCopy || grayOut) {
      return <></>;
    }

    if (hasCopiedText) {
      return <>Copied</>;
    }

    if (!isHovered) {
      return <></>;
    }

    return (
      <IconButton
        aria-label="Copy"
        size="xs"
        minW="10px"
        h="10px"
        variant="plain"
        onClick={() => copyToClipboard(value)}
        display="flex"
        alignItems="center"
        justifyContent="center">
        <PiCopy size="10px" />
      </IconButton>
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
