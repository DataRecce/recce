import { Box, Flex, IconButton } from "@chakra-ui/react";
import { ReactNode, useState } from "react";
import { PiCopy } from "react-icons/pi";
import { useCopyToClipboard } from "usehooks-ts";

interface DiffTextProps {
  value: string;
  colorPalette: string;
  grayOut?: boolean;
  noCopy?: boolean;
  fontSize?: string;
}

export const DiffText = ({
  value,
  colorPalette,
  grayOut,
  noCopy,
  fontSize,
}: DiffTextProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Flex
      p="2px 5px"
      minWidth="30px"
      maxWidth="200px"
      overflow="hidden"
      textOverflow="ellipsis"
      color={`${colorPalette}.800`}
      backgroundColor={`${colorPalette}.100`}
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
      }}
    >
      <Box
        overflow="hidden"
        textOverflow="ellipsis"
        color={grayOut ? "gray" : "inherit"}
      >
        {value}
      </Box>

      <CopyControl
        value={value}
        noCopy={noCopy}
        grayOut={grayOut}
        isHovered={isHovered}
      />
    </Flex>
  );
};

interface CopyControlProps {
  value: string;
  grayOut?: boolean;
  noCopy?: boolean;
  isHovered: boolean;
}

function CopyControl({
  value,
  noCopy,
  grayOut,
  isHovered,
}: CopyControlProps): ReactNode {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const hasCopiedText = Boolean(copiedText);

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
      justifyContent="center"
    >
      <PiCopy size="10px" />
    </IconButton>
  );
}
