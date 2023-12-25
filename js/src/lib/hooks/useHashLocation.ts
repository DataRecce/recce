import { navigate, useLocationProperty } from "wouter/use-location";

const hashNavigate = (to: string) => navigate("#!" + to);

export const useHashLocation = () => {
  const location = useLocationProperty(
    () => window.location.hash.replace(/^#!/, "") || "/",
    () => "/ssr"
  );
  return [location, hashNavigate];
};
