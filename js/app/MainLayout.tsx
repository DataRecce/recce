/**
 * MainLayout - Handles parallel route visibility and main app structure
 *
 * This component manages the visibility of the @lineage parallel route
 * while keeping it mounted to preserve React state (React Flow graph state, etc.)
 */

"use client";

import { Box, Center, Flex, Spinner } from "@chakra-ui/react";
import { usePathname } from "next/navigation";
import React, { ReactNode, Suspense, useEffect } from "react";
import AuthModal from "@/components/AuthModal/AuthModal";
import { RunList } from "@/components/run/RunList";
import { RunResultPane } from "@/components/run/RunResultPane";
import { HSplit, VSplit } from "@/components/split/Split";
import { trackInit } from "@/lib/api/track";
import { useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { useRecceInstanceContext } from "@/lib/hooks/RecceInstanceContext";
import { useRecceServerFlag } from "@/lib/hooks/useRecceServerFlag";
import "@fontsource/montserrat/800.css";
import NavBar from "app/(mainComponents)/NavBar";
import TopBar from "app/(mainComponents)/TopBar";

interface MainLayoutProps {
  children: ReactNode;
  /** Parallel route slot from @lineage */
  lineage: ReactNode;
}

function MainContentLoading(): ReactNode {
  return (
    <Flex
      height="100%"
      align="center"
      justify="center"
      style={{ contain: "size" }}
    >
      <Center h="100%">
        <Spinner size="xl" />
      </Center>
    </Flex>
  );
}

export function MainLayout({ children, lineage }: MainLayoutProps) {
  const pathname = usePathname();
  const { isDemoSite, isLoading, isCodespace } = useLineageGraphContext();
  const { featureToggles } = useRecceInstanceContext();

  // Determine if lineage route is active
  const isLineageRoute = pathname === "/lineage" || pathname === "/";

  useEffect(() => {
    trackInit();
  }, []);

  return (
    <Flex direction="column" height="100vh" overflow="hidden">
      <TopBar />
      <NavBar />
      <Main isLineageRoute={isLineageRoute} lineage={lineage}>
        <Suspense fallback={<MainContentLoading />}>{children}</Suspense>
      </Main>
      {!isLoading &&
        !isDemoSite &&
        !isCodespace &&
        featureToggles.mode === null && <AuthModal />}
    </Flex>
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
      <Box style={{ contain: "size" }}>{_isHistoryOpen && <RunList />}</Box>
      <VSplit
        sizes={_isRunResultOpen ? [50, 50] : [100, 0]}
        minSize={_isRunResultOpen ? 100 : 0}
        gutterSize={_isRunResultOpen ? 5 : 0}
        style={{ flex: "1", contain: "size" }}
      >
        <Box p={0} style={{ contain: "content" }}>
          {/*
           * Lineage parallel route - always mounted but visibility controlled
           * This replaces the old RouteAlwaysMount pattern
           */}
          <Box
            display={isLineageRoute ? "block" : "none"}
            height="100%"
            position={isLineageRoute ? "relative" : "absolute"}
            inset={0}
          >
            {lineage}
          </Box>

          {/* Other route content */}
          {!isLineageRoute && children}
        </Box>
        {_isRunResultOpen ? (
          <RunResultPane
            onClose={closeRunResult}
            isSingleEnvironment={!!flag?.single_env_onboarding}
          />
        ) : (
          <Box />
        )}
      </VSplit>
    </HSplit>
  );
}
