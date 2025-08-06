import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { Box, Link, Popover, Portal } from "@chakra-ui/react";
import { useState, cloneElement, ReactElement, useRef, useCallback } from "react";

interface SetupConnectionPopoverProps {
  children: ReactElement<{
    ref?: React.Ref<HTMLElement>;
    [key: string]: unknown;
  }>;
  display: boolean;
}

export default function SetupConnectionPopover({ children, display }: SetupConnectionPopoverProps) {
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ref = useRef<HTMLElement | null>(null);
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

  const childWithHandlers = cloneElement(children, {
    ref,
  });

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
      autoFocus={false}>
      <Popover.Trigger asChild>
        <Box onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} display="contents">
          {childWithHandlers}
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
            onMouseLeave={handleMouseLeave}>
            <Popover.Body>
              Connect to data warehouse to unlock Diff.{" "}
              <Link
                href={RECCE_SUPPORT_CALENDAR_URL}
                color="white"
                target="_blank"
                textDecoration="underline">
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
