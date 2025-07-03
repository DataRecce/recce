"use client";

import { ReactNode } from "react";
import { reactQueryClient } from "@/lib/api/axiosClient";
import { useHashLocation } from "@/lib/hooks/useHashLocation";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { checkboxTheme } from "@theme/components/Checkbox";
import { tooltipTheme } from "@theme/components/Tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import RecceContextProvider from "@/lib/hooks/RecceContextProvider";

const chakraTheme = extendTheme({
  components: {
    Checkbox: checkboxTheme,
    Tooltip: tooltipTheme,
  },
  colors: {
    brand: {
      100: "#fd683e",
      200: "#fd683e",
      300: "#fd683e",
      400: "#fd683e",
      500: "#fd683e",
      600: "#fd683e",
      700: "#fd683e",
      800: "#fd683e",
      900: "#fd683e",
    },
  },
});
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={chakraTheme}>
      <QueryClientProvider client={reactQueryClient}>
        <Router hook={useHashLocation}>
          <RecceContextProvider>{children}</RecceContextProvider>
        </Router>
      </QueryClientProvider>
    </ChakraProvider>
  );
}
