import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { ReactNode, useState } from "react";
import { PiCopy } from "react-icons/pi";
import { useCopyToClipboard } from "usehooks-ts";
import { colors } from "@/components/ui/mui-theme";

interface DiffTextProps {
  value: string;
  colorPalette: "red" | "green";
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

  // Get the color values from the theme colors
  const textColor = colors[colorPalette][800];
  const bgColor = colors[colorPalette][100];

  return (
    <Box
      sx={{
        display: "flex",
        p: "2px 5px",
        minWidth: "30px",
        maxWidth: "200px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: textColor,
        bgcolor: bgColor,
        alignItems: "center",
        gap: "2px",
        borderRadius: "8px",
        fontSize,
        flexShrink: noCopy ? 0 : "inherit",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <Box
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          color: grayOut ? "gray" : "inherit",
        }}
      >
        {value}
      </Box>

      <CopyControl
        value={value}
        noCopy={noCopy}
        grayOut={grayOut}
        isHovered={isHovered}
      />
    </Box>
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
      size="small"
      onClick={() => copyToClipboard(value)}
      sx={{
        minWidth: "10px",
        height: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 0,
      }}
    >
      <PiCopy size="10px" />
    </IconButton>
  );
}
