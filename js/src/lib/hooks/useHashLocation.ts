import { BaseLocationHook, Path } from "wouter";
import { navigate, useLocationProperty } from "wouter/use-browser-location";

function hashNavigate(
  to: Path,
  options?: { state?: unknown; replace?: boolean },
): void {
  navigate("#!" + to);
}

export const useHashLocation: BaseLocationHook = (options?: {
  ssrPath?: Path;
}) => {
  const location = useLocationProperty(
    () => window.location.hash.replace(/^#!/, "") || "/",
    () => "/ssr",
  );
  return [location, hashNavigate];
};
