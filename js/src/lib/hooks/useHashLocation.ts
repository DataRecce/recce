import {
  BaseLocationHook,
  navigate,
  useLocationProperty,
} from "wouter/use-location";

const hashNavigate = (to: string) => navigate("#!" + to);

export const useHashLocation: BaseLocationHook = () => {
  const location = useLocationProperty(
    () => window.location.hash.replace(/^#!/, "") || "/",
    () => "/ssr"
  );
  return [location, hashNavigate];
};
