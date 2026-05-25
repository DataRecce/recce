import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "recce:canceledRuns";
const MAX_ENTRIES = 200;
// Custom event name used to broadcast `add()` calls to other hook instances
// in the SAME tab. The `storage` event only fires for cross-tab writes, so
// without this, sibling components (e.g. RunView and useRun) would diverge:
// useRun writes the runId, but RunView's hook instance keeps its old `ids`
// state and `has(runId)` returns false. This caused the in-flight `waitRun`
// poll to revert RunView from Cancelled back to Running on PR #1376.
const SAME_TAB_EVENT = "recce:canceledRuns:changed";

function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota / private-mode failures: silently drop.
  }
}

export interface UseCanceledRunsResult {
  has: (runId: string) => boolean;
  add: (runId: string) => void;
}

export function useCanceledRuns(): UseCanceledRunsResult {
  const [ids, setIds] = useState<string[]>(() => readFromStorage());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      // Prefer the event's newValue (matches actual cross-tab semantics where
      // the other tab has already written before this event fires); fall back
      // to re-reading storage when newValue is absent.
      if (e.newValue == null) {
        setIds(readFromStorage());
        return;
      }
      try {
        const parsed = JSON.parse(e.newValue);
        if (!Array.isArray(parsed)) {
          setIds([]);
          return;
        }
        setIds(parsed.filter((x): x is string => typeof x === "string"));
      } catch {
        setIds(readFromStorage());
      }
    };
    // Same-tab cross-instance sync: when ANY hook instance calls `add()` it
    // dispatches a custom event so sibling instances refresh from storage.
    const onSameTab = () => setIds(readFromStorage());
    window.addEventListener("storage", onStorage);
    window.addEventListener(SAME_TAB_EVENT, onSameTab);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SAME_TAB_EVENT, onSameTab);
    };
  }, []);

  const has = useCallback((runId: string) => ids.includes(runId), [ids]);

  const add = useCallback((runId: string) => {
    // Read-compute-write OUTSIDE the state updater so the updater stays pure
    // (React requires this — under StrictMode dev builds, updaters are invoked
    // twice to surface impurity, which would double the localStorage write and
    // the same-tab broadcast). Reading from storage rather than `ids` ensures
    // any cross-instance writes that happened since this render are honored.
    const prev = readFromStorage();
    if (prev.includes(runId)) {
      // No-op: keep instance state in sync with storage but skip the broadcast.
      setIds(prev);
      return;
    }
    const next = [...prev, runId];
    const trimmed =
      next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    writeToStorage(trimmed);
    setIds(trimmed);
    // Broadcast to other hook instances in the same tab AFTER state + storage
    // are settled. dispatchEvent is synchronous, so sibling listeners will run
    // before this callback returns — they read fresh storage, which now has
    // the new entry.
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new Event(SAME_TAB_EVENT));
      } catch {
        // Silently ignore — older browsers / restricted contexts.
      }
    }
  }, []);

  return { has, add };
}
