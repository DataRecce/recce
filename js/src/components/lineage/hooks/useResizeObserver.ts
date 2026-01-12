import type { RefObject } from "react";
import { useEffect, useRef } from "react";

/**
 * Hook that observes element resize and calls a handler when the size changes
 * significantly (more than 10px difference in width or height).
 *
 * Used to trigger layout updates when the lineage view container is resized.
 *
 * @param ref - RefObject pointing to the HTML element to observe
 * @param handler - Callback function to invoke when resize is detected
 */
export const useResizeObserver = (
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
) => {
  const size = useRef({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const target = ref.current;
    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        if (
          Math.abs(newHeight - size.current.height) > 10 ||
          Math.abs(newWidth - size.current.width) > 10
        ) {
          if (
            size.current.height > 0 &&
            newHeight > 0 &&
            size.current.width > 0 &&
            newWidth > 0
          ) {
            handler();
          }
        }
        size.current = {
          width: newWidth,
          height: newHeight,
        };
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (target) {
      resizeObserver.observe(target);
    }

    return () => {
      if (target) {
        resizeObserver.unobserve(target);
      }
    };
  }, [handler, ref]);
};
