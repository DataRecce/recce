"use client";

import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

/**
 * Toast types and interfaces
 */
export interface ToastOptions {
  id?: string;
  title?: string;
  description?: ReactNode;
  type?: "success" | "error" | "warning" | "info" | "loading";
  duration?: number;
  closable?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastState extends ToastOptions {
  id: string;
  open: boolean;
}

interface ToasterContextValue {
  toast: (options: ToastOptions) => string;
  success: (options: Omit<ToastOptions, "type">) => string;
  error: (options: Omit<ToastOptions, "type">) => string;
  warning: (options: Omit<ToastOptions, "type">) => string;
  info: (options: Omit<ToastOptions, "type">) => string;
  loading: (options: Omit<ToastOptions, "type">) => string;
  dismiss: (id: string) => void;
  update: (id: string, options: Partial<ToastOptions>) => void;
}

const ToasterContext = createContext<ToasterContextValue | null>(null);

let toastIdCounter = 0;

/**
 * Simple toaster implementation using MUI Snackbar
 */
export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const createToast = useCallback((options: ToastOptions): string => {
    const id = options.id || `toast-${++toastIdCounter}`;
    const newToast: ToastState = {
      id,
      open: true,
      duration: options.type === "loading" ? null : (options.duration ?? 5000),
      closable: options.closable ?? true,
      ...options,
    } as ToastState;

    setToasts((prev) => {
      // Remove existing toast with same id
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, newToast];
    });

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
    // Remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const update = useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...options } : t)),
    );
  }, []);

  const contextValue: ToasterContextValue = {
    toast: createToast,
    success: (opts) => createToast({ ...opts, type: "success" }),
    error: (opts) => createToast({ ...opts, type: "error" }),
    warning: (opts) => createToast({ ...opts, type: "warning" }),
    info: (opts) => createToast({ ...opts, type: "info" }),
    loading: (opts) => createToast({ ...opts, type: "loading" }),
    dismiss,
    update,
  };

  return (
    <ToasterContext.Provider value={contextValue}>
      {children}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={toast.open}
          autoHideDuration={toast.duration}
          onClose={() => toast.closable && dismiss(toast.id)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={toast.type === "loading" ? "info" : toast.type || "info"}
            onClose={toast.closable ? () => dismiss(toast.id) : undefined}
            icon={
              toast.type === "loading" ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
            sx={{ width: "100%", minWidth: 300 }}
          >
            <Stack spacing={0.5}>
              {toast.title && (
                <Typography variant="subtitle2" fontWeight="bold">
                  {toast.title}
                </Typography>
              )}
              {toast.description && (
                <Typography variant="body2" component="div">
                  {toast.description}
                </Typography>
              )}
            </Stack>
          </Alert>
        </Snackbar>
      ))}
    </ToasterContext.Provider>
  );
}

/**
 * Hook to use the toaster
 */
export function useToaster(): ToasterContextValue {
  const context = useContext(ToasterContext);
  if (!context) {
    throw new Error("useToaster must be used within ToasterProvider");
  }
  return context;
}

/**
 * Standalone toaster instance for use outside React context
 * Uses a simple event-based system
 */
interface ToastEvent {
  type: "create" | "dismiss" | "update";
  options?: ToastOptions;
  id?: string;
}

const listeners: Set<(event: ToastEvent) => void> = new Set();

export const toaster = {
  create: (options: ToastOptions): string => {
    const id = options.id || `toast-${++toastIdCounter}`;
    listeners.forEach((listener) =>
      listener({ type: "create", options: { ...options, id } }),
    );
    return id;
  },
  success: (options: Omit<ToastOptions, "type">) =>
    toaster.create({ ...options, type: "success" }),
  error: (options: Omit<ToastOptions, "type">) =>
    toaster.create({ ...options, type: "error" }),
  warning: (options: Omit<ToastOptions, "type">) =>
    toaster.create({ ...options, type: "warning" }),
  info: (options: Omit<ToastOptions, "type">) =>
    toaster.create({ ...options, type: "info" }),
  loading: (options: Omit<ToastOptions, "type">) =>
    toaster.create({ ...options, type: "loading" }),
  dismiss: (id: string) => {
    listeners.forEach((listener) => listener({ type: "dismiss", id }));
  },
  // Alias for dismiss (for backward compatibility)
  remove: (id: string) => {
    listeners.forEach((listener) => listener({ type: "dismiss", id }));
  },
  update: (id: string, options: Partial<ToastOptions>) => {
    listeners.forEach((listener) => listener({ type: "update", id, options }));
  },
  subscribe: (listener: (event: ToastEvent) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Toaster component that renders toasts from the standalone toaster
 */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // Subscribe to toast events
  useState(() => {
    const unsubscribe = toaster.subscribe((event) => {
      if (event.type === "create" && event.options) {
        const newToast: ToastState = {
          id: event.options.id || `toast-${++toastIdCounter}`,
          open: true,
          duration:
            event.options.type === "loading"
              ? undefined
              : (event.options.duration ?? 5000),
          closable: event.options.closable ?? true,
          ...event.options,
        } as ToastState;
        setToasts((prev) => {
          const filtered = prev.filter((t) => t.id !== newToast.id);
          return [...filtered, newToast];
        });
      } else if (event.type === "dismiss" && event.id) {
        const id = event.id;
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 300);
      } else if (event.type === "update" && event.id && event.options) {
        setToasts((prev) =>
          prev.map((t) => (t.id === event.id ? { ...t, ...event.options } : t)),
        );
      }
    });
    return unsubscribe;
  });

  const handleClose = (id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, open: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  return (
    <>
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={toast.open}
          autoHideDuration={toast.duration}
          onClose={() => toast.closable && handleClose(toast.id)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={toast.type === "loading" ? "info" : toast.type || "info"}
            onClose={toast.closable ? () => handleClose(toast.id) : undefined}
            icon={
              toast.type === "loading" ? (
                <CircularProgress size={20} color="inherit" />
              ) : undefined
            }
            sx={{ width: "100%", minWidth: 300 }}
          >
            <Stack spacing={0.5}>
              {toast.title && (
                <Typography variant="subtitle2" fontWeight="bold">
                  {toast.title}
                </Typography>
              )}
              {toast.description && (
                <Typography variant="body2" component="div">
                  {toast.description}
                </Typography>
              )}
            </Stack>
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
