"use client";

import MuiBox from "@mui/material/Box";
import type { CardProps as MuiCardProps } from "@mui/material/Card";
import MuiCard from "@mui/material/Card";
import MuiCardActions from "@mui/material/CardActions";
import MuiCardContent from "@mui/material/CardContent";
import MuiCardHeader from "@mui/material/CardHeader";
import { forwardRef, type ReactNode } from "react";

/**
 * Card Components - MUI equivalent of Chakra's Card compound components
 */

// Card Root
export interface CardRootProps extends Omit<MuiCardProps, "ref"> {
  children?: ReactNode;
  maxWidth?: string;
}

export const CardRoot = forwardRef<HTMLDivElement, CardRootProps>(
  function CardRoot({ children, maxWidth, sx, ...props }, ref) {
    return (
      <MuiCard
        ref={ref}
        sx={{
          ...(maxWidth && { maxWidth }),
          ...sx,
        }}
        {...props}
      >
        {children}
      </MuiCard>
    );
  },
);

// Card Header
export interface CardHeaderProps {
  children?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  function CardHeader({ children }, ref) {
    return (
      <MuiBox ref={ref} sx={{ px: 2, pt: 2 }}>
        {children}
      </MuiBox>
    );
  },
);

// Card Title
export interface CardTitleProps {
  children?: ReactNode;
  fontSize?: number | string;
}

export const CardTitle = forwardRef<HTMLDivElement, CardTitleProps>(
  function CardTitle({ children, fontSize }, ref) {
    return (
      <MuiBox
        ref={ref}
        component="h3"
        sx={{
          fontSize: fontSize || "1.25rem",
          fontWeight: "bold",
          m: 0,
        }}
      >
        {children}
      </MuiBox>
    );
  },
);

// Card Description
export interface CardDescriptionProps {
  children?: ReactNode;
}

export const CardDescription = forwardRef<HTMLDivElement, CardDescriptionProps>(
  function CardDescription({ children }, ref) {
    return (
      <MuiBox ref={ref} sx={{ color: "text.secondary" }}>
        {children}
      </MuiBox>
    );
  },
);

// Card Body
export interface CardBodyProps {
  children?: ReactNode;
}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  function CardBody({ children }, ref) {
    return <MuiCardContent ref={ref}>{children}</MuiCardContent>;
  },
);

// Card Footer
export interface CardFooterProps {
  children?: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  function CardFooter({ children }, ref) {
    return <MuiCardActions ref={ref}>{children}</MuiCardActions>;
  },
);

// Combined Card namespace
export const Card = {
  Root: CardRoot,
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  Body: CardBody,
  Footer: CardFooter,
};

export default Card;
