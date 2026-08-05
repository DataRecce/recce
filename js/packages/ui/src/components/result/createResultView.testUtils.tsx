import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { theme } from "../../theme";

export const screenshotBoxMock = React.forwardRef<
  HTMLDivElement,
  { children?: ReactNode }
>(function MockScreenshotBox({ children }, ref) {
  return (
    <div ref={ref} data-testid="screenshot-box-mock">
      {children}
    </div>
  );
});

export const screenshotDataGridMock = React.forwardRef<
  {
    api: null;
    element: null;
  },
  {
    columns?: unknown[];
    rows?: unknown[];
    children?: ReactNode;
  }
>(function MockScreenshotDataGrid({ columns, rows, children }, ref) {
  React.useImperativeHandle(ref, () => ({
    api: null,
    element: null,
  }));

  const columnCount = columns?.length ?? 0;
  const rowCount = rows?.length ?? 0;

  return (
    <div
      data-testid="screenshot-data-grid-mock"
      data-columns={columnCount}
      data-rows={rowCount}
    >
      {children ?? `Mock Grid: ${rowCount} rows, ${columnCount} columns`}
    </div>
  );
});

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): ReturnType<typeof render> {
  return render(ui, { wrapper: TestProviders, ...options });
}
