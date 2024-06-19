import { Button, Icon, IconButton, Spinner, Tooltip } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { TfiCloudDown, TfiCloudUp, TfiReload } from "react-icons/tfi";
import { syncState, isStateSyncing } from "@/lib/api/state";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { useLocation } from "wouter";

function isCheckDetailPage(href: string): boolean {
  const pattern = /^\/checks\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
  return pattern.test(href);
}

export function StateSpinner() {
  return (<Tooltip label="Loading">
    <Button pt="6px" variant='unstyled'  boxSize={"1.2em"} >
      <Spinner/>
    </Button>
  </Tooltip>);
}

export function StateSynchronizer() {
  const [isSyncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  const checkSyncStatus = useCallback(async () => {
    if (await isStateSyncing()) {
      return;
    }
    setSyncing(false);

    // Refresh the lineage graph and checks
    queryClient.invalidateQueries({ queryKey: cacheKeys.lineage() });
    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
  }, [setSyncing, queryClient]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSyncing) {
      intervalId = setInterval(checkSyncStatus, 2000);
    }

    return () => {
      if (intervalId) {
        if (isCheckDetailPage(location)) {
          setLocation("/checks");
        }
        clearInterval(intervalId);
      }
    };
  }, [isSyncing, checkSyncStatus, setLocation, location])


  const requestSyncStatus = useCallback(async () => {
    if (await isStateSyncing() === false) {
      await syncState();
    }
    setSyncing(true);
  }, [setSyncing]);

  if (isSyncing) return <StateSpinner/>;
  return (<Tooltip label="Sync with Cloud">
    <IconButton
      pt="6px"
      variant="unstyled"
      aria-label="Sync state"
      onClick={requestSyncStatus}
      icon={<Icon as={TfiReload} boxSize={"1.2em"} />}
    />
  </Tooltip>);
}

export function StateCloudUploader() {
  return (<Tooltip label="Upload to Cloud">
    <IconButton
      pt="6px"
      variant="unstyled"
      aria-label="Upload state"
      icon={<Icon as={TfiCloudUp} boxSize={"1.2em"} />}
    />
  </Tooltip>);
}

export function StateCloudDownloader() {
  return (<Tooltip label="Download from Cloud">
    <IconButton
      pt="6px"
      variant="unstyled"
      aria-label="Download state"
      icon={<Icon as={TfiCloudDown} boxSize={"1.2em"} />}
    />
  </Tooltip>);
}
