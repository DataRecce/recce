"use client";

import { ReactNode } from "react";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { createTheme, ThemeProvider } from "@mui/material";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { checkboxTheme } from "@theme/components/Checkbox";
import { tooltipTheme } from "@theme/components/Tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";

const muiDefaultTheme = createTheme({
  components: {
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          zIndex: 1500,
        },
      },
    },
  },
});

const chakraTheme = extendTheme({
  components: {
    Checkbox: checkboxTheme,
    Tooltip: tooltipTheme,
  },
});
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={muiDefaultTheme}>
      <ChakraProvider theme={chakraTheme}>
        <QueryClientProvider client={reactQueryClient}>
          <Router hook={useHashLocation}>
            <RecceContextProvider>{children}</RecceContextProvider>
          </Router>
        </QueryClientProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
