import { useCallback, useState } from "react";

export type ProfileMode = "strip" | "grid";

export const STORAGE_KEY = "recce:schema:profileMode";
const DEFAULT_MODE: ProfileMode = "grid";
const VALID_MODES: readonly ProfileMode[] = ["strip", "grid"];

function readStoredMode(): ProfileMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw && (VALID_MODES as readonly string[]).includes(raw)) {
    return raw as ProfileMode;
  }
  return DEFAULT_MODE;
}

/**
 * Persists the user's chosen inline-profile render mode to localStorage
 * under a single global key. Returns the current mode and a setter.
 */
export function useProfileMode(): [ProfileMode, (mode: ProfileMode) => void] {
  const [mode, setModeState] = useState<ProfileMode>(() => readStoredMode());

  const setMode = useCallback((next: ProfileMode) => {
    setModeState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return [mode, setMode];
}
