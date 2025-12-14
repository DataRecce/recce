"use client";

import type { AvatarProps as MuiAvatarProps } from "@mui/material/Avatar";
import MuiAvatar from "@mui/material/Avatar";
import MuiAvatarGroup from "@mui/material/AvatarGroup";
import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

/**
 * Avatar Component - MUI equivalent of Chakra's Avatar
 *
 * Displays a user avatar with image, initials, or fallback.
 * Supports both simple usage and compound pattern.
 */

// Context for compound pattern
interface AvatarContextValue {
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  name?: string;
  src?: string;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
  return useContext(AvatarContext);
}

export interface AvatarProps extends Omit<MuiAvatarProps, "ref"> {
  /** Name of the person (used for initials and alt text) */
  name?: string;
  /** Size of the avatar */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Fallback element when no image/name */
  fallback?: ReactNode;
}

const sizeMap: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  "2xl": 96,
};

function getInitials(name?: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AvatarSimple = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { name, size = "md", fallback, src, alt, sx, ...props },
  ref,
) {
  const pixelSize = sizeMap[size] || 40;
  const initials = getInitials(name);

  return (
    <MuiAvatar
      ref={ref}
      src={src}
      alt={alt || name}
      sx={{
        width: pixelSize,
        height: pixelSize,
        fontSize: pixelSize * 0.4,
        ...sx,
      }}
      {...props}
    >
      {!src && (fallback || initials || null)}
    </MuiAvatar>
  );
});

// Compound pattern components
export interface AvatarRootProps extends Omit<BoxProps, "ref"> {
  children?: ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  name?: string;
  src?: string;
  /** Outline style */
  outlineStyle?: string;
  /** Outline width */
  outlineWidth?: string;
  /** Outline color */
  outlineColor?: string;
  /** Cursor style */
  cursor?: string;
}

const AvatarRoot = forwardRef<HTMLDivElement, AvatarRootProps>(
  function AvatarRoot(
    {
      children,
      size = "md",
      name,
      src,
      outlineStyle,
      outlineWidth,
      outlineColor,
      cursor,
      sx,
      ...props
    },
    ref,
  ) {
    const pixelSize = sizeMap[size] || 40;

    const combinedSx = useMemo((): SxProps<Theme> => {
      const styles: Record<string, unknown> = {
        display: "inline-flex",
        position: "relative",
        width: pixelSize,
        height: pixelSize,
        borderRadius: "50%",
      };

      if (outlineStyle) styles.outlineStyle = outlineStyle;
      if (outlineWidth) styles.outlineWidth = outlineWidth;
      if (outlineColor) styles.outlineColor = outlineColor;
      if (cursor) styles.cursor = cursor;

      if (sx && typeof sx === "object" && !Array.isArray(sx)) {
        return { ...styles, ...sx } as SxProps<Theme>;
      }

      return styles as SxProps<Theme>;
    }, [pixelSize, outlineStyle, outlineWidth, outlineColor, cursor, sx]);

    return (
      <AvatarContext.Provider value={{ size, name, src }}>
        <Box ref={ref} sx={combinedSx} {...props}>
          {children}
        </Box>
      </AvatarContext.Provider>
    );
  },
);

// Avatar Fallback - Shows when image fails or doesn't exist
interface AvatarFallbackProps {
  children?: ReactNode;
  name?: string;
}

function AvatarFallback({ children, name }: AvatarFallbackProps) {
  const context = useAvatarContext();
  const avatarName = name || context?.name;
  const initials = getInitials(avatarName);
  const pixelSize = sizeMap[context?.size || "md"] || 40;

  return (
    <MuiAvatar
      sx={{
        width: pixelSize,
        height: pixelSize,
        fontSize: pixelSize * 0.4,
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      {children || initials}
    </MuiAvatar>
  );
}

// Avatar Image - The actual image
interface AvatarImageProps {
  src?: string;
  alt?: string;
}

function AvatarImage({ src, alt }: AvatarImageProps) {
  const context = useAvatarContext();
  const imageSrc = src || context?.src;
  const pixelSize = sizeMap[context?.size || "md"] || 40;

  if (!imageSrc) return null;

  return (
    <MuiAvatar
      src={imageSrc}
      alt={alt || context?.name}
      sx={{
        width: pixelSize,
        height: pixelSize,
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
}

// Compound component export
export const Avatar = Object.assign(AvatarSimple, {
  Root: AvatarRoot,
  Fallback: AvatarFallback,
  Image: AvatarImage,
});

// Export AvatarGroup for convenience
export { MuiAvatarGroup as AvatarGroup };

export default Avatar;
