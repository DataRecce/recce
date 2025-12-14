"use client";

import { Badge } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import React, { type ReactNode, useEffect, useMemo, useRef } from "react";
import { EnvInfo } from "@/components/app/EnvInfo";
import { Filename } from "@/components/app/Filename";
import { StateExporter } from "@/components/app/StateExporter";
import { TopLevelShare } from "@/components/app/StateSharing";
import { StateSynchronizer } from "@/components/app/StateSynchronizer";
import { Box, Flex, Tabs } from "@/components/ui/mui";
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
  children: ReactNode;
}

function TabBadge<T>({
  queryKey,
  fetchCallback,
  selectCallback,
  children,
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
    <Badge
      badgeContent={count}
      color="primary"
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
    >
      {children}
    </Badge>
  );
}

function ChecklistBadge({ children }: { children: ReactNode }): ReactNode {
  return (
    <TabBadge<Check[]>
      queryKey={cacheKeys.checks()}
      fetchCallback={listChecks}
      selectCallback={(checks: Check[]) => {
        return checks.filter((check) => !check.is_checked).length;
      }}
    >
      {children}
    </TabBadge>
  );
}

// NavBar component with Next.js Link navigation
export default function NavBar() {
  const pathname = usePathname();
  const { isDemoSite, isLoading, cloudMode } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();
  const { data: flag, isLoading: isFlagLoading } = useRecceServerFlag();

  // Track navigation changes with previous pathname
  const prevPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPathnameRef.current && prevPathnameRef.current !== pathname) {
      trackNavigation({ from: prevPathnameRef.current, to: pathname });
    }
    prevPathnameRef.current = pathname;
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
      colorPalette="iochmara"
      value={currentTab}
      size="sm"
      variant="line"
      sx={{ borderBottom: "1px solid lightgray", px: "12px" }}
    >
      {/* Grid layout outside Tabs.List so MUI Tabs can find tab children */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          width: "100%",
          alignItems: "center",
        }}
      >
        {/* Left section: Tabs */}
        <Tabs.List sx={{ borderBottom: "none", minHeight: "auto" }}>
          {ROUTE_CONFIG.map(({ path, name }) => {
            const disable = name === "Query" && flag?.single_env_onboarding;

            if (name === "Checklist" && ChecklistBadge) {
              return (
                <Tabs.Trigger
                  key={path}
                  value={path}
                  disabled={isLoading || isFlagLoading || disable}
                  hidden={disable}
                >
                  <ChecklistBadge>
                    <NextLink
                      href={path}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {name}
                    </NextLink>
                  </ChecklistBadge>
                </Tabs.Trigger>
              );
            }

            return (
              <Tabs.Trigger
                key={path}
                value={path}
                disabled={isLoading || isFlagLoading || disable}
                hidden={disable}
              >
                <NextLink
                  href={path}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  {name}
                </NextLink>
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        {/* Center section: Filename and TopLevelShare */}
        <Flex
          sx={{ alignItems: "center", gap: "12px", justifyContent: "center" }}
        >
          {!isLoading && !isDemoSite && <Filename />}
          {!isLoading &&
            !isDemoSite &&
            !flag?.single_env_onboarding &&
            !featureToggles.disableShare && <TopLevelShare />}
        </Flex>

        {/* Right section: EnvInfo, StateSynchronizer, StateExporter */}
        {!isLoading && (
          <Flex
            sx={{ justifyContent: "right", alignItems: "center", mr: "8px" }}
          >
            <EnvInfo />
            {cloudMode && <StateSynchronizer />}
            <StateExporter />
          </Flex>
        )}
      </Box>
    </Tabs.Root>
  );
}
