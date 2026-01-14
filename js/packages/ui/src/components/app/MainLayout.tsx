/**
 * MainLayout - Handles parallel route visibility and main app structure
 *
 * This component manages the visibility of the @lineage parallel route
 * while keeping it mounted to preserve React state (React Flow graph state, etc.)
 */

"use client";

import "@fontsource/montserrat/800.css";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { usePathname } from "next/navigation";
import React, { type ReactNode, Suspense, useEffect } from "react";
import {
  useLineageGraphContext,
  useRecceActionContext,
  useRecceInstanceContext,
  useRecceServerFlag,
} from "../../contexts";
import { trackInit } from "../../lib/api/track";
import { RunListOss, RunResultPaneOss as RunResultPane } from "../run";
import { HSplit, VSplit } from "../ui";
import AuthModal from "./AuthModal";
import { NavBarOss as NavBar } from "./NavBarOss";
import { TopBarOss as TopBar } from "./TopBarOss";

interface MainLayoutProps {
  children: ReactNode;
  /** Parallel route slot from @lineage */
  lineage: ReactNode;
}

function MainContentLoading(): ReactNode {
  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        contain: "size",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <CircularProgress size={48} />
      </Box>
    </Box>
  );
}

export function MainLayout({ children, lineage }: MainLayoutProps) {
  const pathname = usePathname();
  const { isDemoSite, isLoading, isCodespace } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();

  // Determine if lineage route is active (handle trailing slashes)
  const normalizedPath = pathname.replace(/\/$/, "") || "/";
  const isLineageRoute =
    normalizedPath === "/lineage" || normalizedPath === "/";

  useEffect(() => {
    trackInit();
  }, []);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <TopBar />
      <NavBar />
      <Main isLineageRoute={isLineageRoute} lineage={lineage}>
        {children}
      </Main>
      {!isLoading &&
        !isDemoSite &&
        !isCodespace &&
        featureToggles.mode === null && <AuthModal />}
    </Box>
  );
}

// Main content area with parallel route handling
interface MainProps {
  children: ReactNode;
  lineage: ReactNode;
  isLineageRoute: boolean;
}

function Main({ children, lineage, isLineageRoute }: MainProps) {
  const { isRunResultOpen, isHistoryOpen, closeRunResult } =
    useRecceActionContext();
  const { data: flag } = useRecceServerFlag();
  const pathname = usePathname();

  const _isRunResultOpen = isRunResultOpen && !pathname.startsWith("/checks");
  const _isHistoryOpen = isHistoryOpen && !pathname.startsWith("/checks");

  return (
    <HSplit
      sizes={[0, 100]}
      minSize={_isHistoryOpen ? 300 : 0}
      gutterSize={_isHistoryOpen ? 5 : 0}
      style={{ height: "100%" }}
    >
      {/* suppressHydrationWarning: react-split adds inline styles after mount */}
      <Box style={{ contain: "size" }} suppressHydrationWarning>
        {_isHistoryOpen && <RunListOss />}
      </Box>
      <VSplit
        sizes={_isRunResultOpen ? [50, 50] : [100, 0]}
        minSize={_isRunResultOpen ? 100 : 0}
        gutterSize={_isRunResultOpen ? 5 : 0}
        style={{ flex: "1", contain: "size" }}
      >
        <Suspense fallback={<MainContentLoading />}>
          {/* suppressHydrationWarning: react-split adds inline styles (height, width)
              to children after mount, causing expected server/client mismatches */}
          <Box
            sx={{
              p: 0,
              contain: "content",
              height: "100%",
              position: "relative",
            }}
            suppressHydrationWarning
          >
            {/*
             * Lineage parallel route - always mounted but visibility controlled
             * This replaces the old RouteAlwaysMount pattern
             */}
            <Box
              sx={{
                display: isLineageRoute ? "block" : "none",
                height: "100%",
                position: isLineageRoute ? "relative" : "absolute",
                inset: 0,
              }}
            >
              {lineage}
            </Box>

            {/* Other route content */}
            {!isLineageRoute && children}
          </Box>
        </Suspense>
        {/* suppressHydrationWarning: react-split adds inline styles after mount */}
        <Box sx={{ height: "100%" }} suppressHydrationWarning>
          {_isRunResultOpen ? (
            <RunResultPane
              onClose={closeRunResult}
              isSingleEnvironment={!!flag?.single_env_onboarding}
            />
          ) : null}
        </Box>
      </VSplit>
    </HSplit>
  );
}
