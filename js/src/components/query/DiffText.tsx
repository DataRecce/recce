import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { ReactNode, useState } from "react";
import { PiCopy } from "react-icons/pi";
import { useCopyToClipboard } from "usehooks-ts";
import { colors } from "@/components/ui/mui-theme";
import { useClipBoardToast } from "@/lib/hooks/useClipBoardToast";

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
  const [, copyToClipboard] = useCopyToClipboard();
  const { successToast } = useClipBoardToast();

  if (noCopy || grayOut || !isHovered) {
    return <></>;
  }

  const handleCopy = () => {
    copyToClipboard(value);
    successToast(`${value} copied`);
  };

  return (
    <Tooltip title="Copy Value">
      <IconButton
        aria-label="Copy"
        size="small"
        onClick={handleCopy}
        sx={{
          minWidth: "0.625rem",
          height: "0.625rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 0,
          color: "inherit",
        }}
      >
        <PiCopy size="0.625rem" />
      </IconButton>
    </Tooltip>
  );
}
