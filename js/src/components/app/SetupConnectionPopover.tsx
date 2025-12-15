import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import { ReactElement, useCallback, useRef, useState } from "react";
import { Popover, Portal } from "@/components/ui/mui";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";

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
  const ref = useRef<HTMLDivElement | null>(null);
  const getAnchorRect = () => ref.current?.getBoundingClientRect() ?? null;

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
    <Popover.Root
      open={hovered}
      onFocusOutside={() => {
        setHovered(false);
      }}
      positioning={{ getAnchorRect }}
      lazyMount
      unmountOnExit
      size="xs"
      autoFocus={false}
    >
      <Popover.Trigger asChild>
        <Box
          ref={ref}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{ display: "contents" }}
        >
          {children}
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            bg="gray.600"
            color="white"
            zIndex="popover"
            width="auto"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Popover.Body>
              Connect to a data warehouse to unlock Diff.{" "}
              <Link
                href={RECCE_SUPPORT_CALENDAR_URL}
                target="_blank"
                sx={{ color: "white", textDecoration: "underline" }}
              >
                Learn more
              </Link>
              .
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
