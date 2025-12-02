import { Box, Flex, Link, Tabs } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import React, { Activity, ReactNode, useEffect, useMemo } from "react";
import { EnvInfo } from "@/components/app/EnvInfo";
import { Filename } from "@/components/app/Filename";
import { StateExporter } from "@/components/app/StateExporter";
import { TopLevelShare } from "@/components/app/StateSharing";
import { StateSynchronizer } from "@/components/app/StateSynchronizer";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check, listChecks } from "@/lib/api/checks";
import { trackNavigation } from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";

/**
 * Route configuration for tabs
 */
const ROUTE_CONFIG = [
  { path: "/lineage", name: "Lineage" },
  { path: "/query", name: "Query" },
  { path: "/checks", name: "Checklist" },
] as const;

interface TabBadgeProps<T> {
  queryKey: string[];
  fetchCallback: () => Promise<T>;
  selectCallback?: (data: T) => number;
}

function TabBadge<T>({
  queryKey,
  fetchCallback,
  selectCallback,
}: TabBadgeProps<T>): ReactNode {
  const {
    data: count,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKey,
    queryFn: fetchCallback,
    select: selectCallback,
  });

  if (isLoading || error || count === 0) {
    return <></>;
  }

  return (
    <Box
      ml="2px"
      maxH={"20px"}
      height="80%"
      aspectRatio={1}
      borderRadius="full"
      bg="tomato"
      alignContent={"center"}
      color="white"
      fontSize="xs"
    >
      {count}
    </Box>
  );
}

// NavBar component with Next.js Link navigation
export default function NavBar() {
  const pathname = usePathname();
  const { isDemoSite, isLoading, cloudMode } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flag, isLoading: isFlagLoading } = useRecceServerFlag();
  const ChecklistBadge = (
    <TabBadge<Check[]>
      queryKey={cacheKeys.checks()}
      fetchCallback={listChecks}
      selectCallback={(checks: Check[]) => {
        return checks.filter((check) => !check.is_checked).length;
      }}
    />
  );
  // Track navigation changes
  useEffect(() => {
    trackNavigation({ from: location.pathname, to: pathname });
  }, [pathname]);

  // Get current tab value from pathname
  const currentTab = useMemo(() => {
    if (pathname.startsWith("/checks")) return "/checks";
    if (pathname.startsWith("/query")) return "/query";
    if (pathname.startsWith("/runs")) return "/runs";
    return "/lineage";
  }, [pathname]);

  return (
    <Tabs.Root
      value={currentTab}
      size="sm"
      variant="line"
      borderBottom="1px solid lightgray"
      px="12px"
    >
      <Tabs.List
        display="grid"
        gridTemplateColumns="1fr auto 1fr"
        width="100%"
        borderBottom="none"
      >
        {/* Left section: Tabs */}
        <Box display="flex" alignItems="center" gap="4px">
          {ROUTE_CONFIG.map(({ path, name }) => {
            const disable = name === "Query" && flag?.single_env_onboarding;

            return (
              <Tabs.Trigger
                key={path}
                value={path}
                asChild
                disabled={isLoading || isFlagLoading || disable}
                hidden={disable}
              >
                <Link href={path}>{name}</Link>
                <Activity mode={name === "Checklist" ? "visible" : "hidden"}>
                  {ChecklistBadge}
                </Activity>
              </Tabs.Trigger>
            );
          })}
        </Box>

        {/* Center section: Filename and TopLevelShare */}
        <Flex alignItems="center" gap="12px" justifyContent="center">
          {!isLoading && !isDemoSite && <Filename />}
          {!isLoading &&
            !isDemoSite &&
            !flag?.single_env_onboarding &&
            !featureToggles.disableShare && <TopLevelShare />}
        </Flex>

        {/* Right section: EnvInfo, StateSynchronizer, StateExporter */}
        {!isLoading && (
          <Flex justifyContent="right" alignItems="center" mr="8px">
            <EnvInfo />
            {cloudMode && <StateSynchronizer />}
            <StateExporter />
          </Flex>
        )}
      </Tabs.List>
    </Tabs.Root>
  );
}
