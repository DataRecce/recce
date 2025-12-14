"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "@/components/ui/color-mode";
import { theme } from "@/components/ui/theme";

export function Provider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ColorModeProvider {...props} />
    </ThemeProvider>
  );
}
