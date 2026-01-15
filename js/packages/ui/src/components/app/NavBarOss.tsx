"use client";

"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import MuiTabs from "@mui/material/Tabs";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import React, { type ReactNode, useEffect, useMemo, useRef } from "react";
import { type Check, cacheKeys, listChecks } from "../../api";
import {
  useLineageGraphContext,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../../contexts";
import { useApiConfig } from "../../hooks/useApiConfig";
import { trackNavigation } from "../../lib/api/track";
import { EnvInfo } from "./EnvInfo";
import { Filename } from "./Filename";
import { StateExporter } from "./StateExporter";
import { TopLevelShare } from "./StateSharing";
import { StateSynchronizer } from "./StateSynchronizer";

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
      bgcolor="brand.main"
      display="flex"
      justifyContent="center"
      alignItems="center"
      p={1}
      borderRadius="100%"
      color="white"
      fontWeight={700}
      fontSize="0.75rem"
    >
      <span>{count}</span>
    </Box>
  );
}

function ChecklistBadge(): ReactNode {
  const { apiClient } = useApiConfig();
  return (
    <TabBadge<Check[]>
      queryKey={cacheKeys.checks()}
      fetchCallback={() => listChecks(apiClient)}
      selectCallback={(checks: Check[]) => {
        return checks.filter((check) => !check.is_checked).length;
      }}
    />
  );
}

// NavBar component with Next.js Link navigation
export const NavBarOss = () => {
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
    <Box sx={{ borderBottom: "1px solid lightgray", px: "12px" }}>
      {/* Grid layout outside Tabs so MUI Tabs can find tab children */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          width: "100%",
          alignItems: "center",
        }}
      >
        {/* Left section: Tabs */}
        <MuiTabs
          value={currentTab}
          sx={{ borderBottom: "none", minHeight: "auto" }}
        >
          {ROUTE_CONFIG.map(({ path, name }) => {
            const disable = name === "Query" && flag?.single_env_onboarding;

            // Don't render hidden tabs
            if (disable) {
              return null;
            }

            if (name === "Checklist" && ChecklistBadge) {
              return (
                <Tab
                  key={path}
                  value={path}
                  disabled={isLoading || isFlagLoading}
                  sx={{
                    p: 0,
                  }}
                  label={
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <NextLink
                        href={path}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          padding: "0.875rem 1.1875rem",
                          display: "flex",
                          gap: 3,
                          alignItems: "center",
                        }}
                      >
                        {name} <ChecklistBadge />
                      </NextLink>
                    </Box>
                  }
                />
              );
            }

            return (
              <Tab
                key={path}
                value={path}
                disabled={isLoading || isFlagLoading}
                sx={{
                  p: 0,
                }}
                label={
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <NextLink
                      href={path}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        padding: "0.875rem 1.1875rem",
                      }}
                    >
                      {name}
                    </NextLink>
                  </Box>
                }
              />
            );
          })}
        </MuiTabs>

        {/* Center section: Filename and TopLevelShare */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            justifyContent: "center",
          }}
        >
          {!isLoading && !isDemoSite && <Filename />}
          {!isLoading &&
            !isDemoSite &&
            !flag?.single_env_onboarding &&
            !featureToggles.disableShare && <TopLevelShare />}
        </Box>

        {/* Right section: EnvInfo, StateSynchronizer, StateExporter */}
        {!isLoading && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "right",
              alignItems: "center",
              mr: "8px",
            }}
          >
            <EnvInfo />
            {cloudMode && <StateSynchronizer />}
            <StateExporter />
          </Box>
        )}
      </Box>
    </Box>
  );
};
