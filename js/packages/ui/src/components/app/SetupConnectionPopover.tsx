import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import MuiPopover from "@mui/material/Popover";
import { ReactElement, useCallback, useRef, useState } from "react";
import { RECCE_SUPPORT_CALENDAR_URL } from "../../lib/const";

interface SetupConnectionPopoverProps {
  children: ReactElement<{
    ref?: React.Ref<HTMLElement>;
    [key: string]: unknown;
  }>;
  display: boolean;
}

export default function SetupConnectionPopover({
  children,
  display,
}: SetupConnectionPopoverProps) {
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setHovered(false);
    }, 100);
  }, []);

  if (!display) {
    return children;
  }

  return (
    <>
      <Box
        ref={anchorRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ display: "contents" }}
      >
        {children}
      </Box>
      <MuiPopover
        open={hovered}
        anchorEl={anchorRef.current}
        onClose={() => setHovered(false)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        disableAutoFocus
        disableEnforceFocus
        sx={{ pointerEvents: "none" }}
        slotProps={{
          paper: {
            onMouseEnter: handleMouseEnter,
            onMouseLeave: handleMouseLeave,
            sx: {
              bgcolor: "grey.600",
              color: "white",
              p: 1.5,
              pointerEvents: "auto",
            },
          },
        }}
      >
        Connect to a data warehouse to unlock Diff.{" "}
        <Link
          href={RECCE_SUPPORT_CALENDAR_URL}
          target="_blank"
          sx={{ color: "white", textDecoration: "underline" }}
        >
          Learn more
        </Link>
        .
      </MuiPopover>
    </>
  );
}
