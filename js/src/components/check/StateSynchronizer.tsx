import { useRunsAggregated, useLineageGraphContext } from "@/lib/hooks/LineageGraphContext";
import { Button, Icon, IconButton, Spinner, Tooltip } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { TfiCloudDown, TfiCloudUp, TfiReload } from "react-icons/tfi";
import { syncState, isStateSyncing } from "@/lib/api/state";

export function StateSpinner() {
  return (<Tooltip label="Loading">
    <Button pt="6px" variant='unstyled'  boxSize={"1.2em"} >
      <Spinner/>
    </Button>
  </Tooltip>);
}

export function StateSynchronizer() {
  const { retchLineageGraph }  = useLineageGraphContext();
  const [isSyncing, setSyncing] = useState(false);

  const checkSyncStatus = useCallback(async () => {
    if (await isStateSyncing()) {
      console.log("Still syncing...");
      return;
    }

    console.log("Syncing done.");
    setSyncing(false);
    // retchLineageGraph && retchLineageGraph();
  }, [setSyncing]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isSyncing) {
      intervalId = setInterval(checkSyncStatus, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSyncing, checkSyncStatus])


  const requestSyncStatus = useCallback(async () => {
    if (await isStateSyncing()) {
      console.log("Already syncing...");
      return;
    }

    console.log("Syncing state...");
    await syncState();
    setSyncing(true);

    // long pulling the sync status
    // await checkSyncStatus();
  }, []);
  return (<Tooltip label="Sync with Cloud">
    {isSyncing ? <StateSpinner/> : <IconButton
      pt="6px"
      variant="unstyled"
      aria-label="Sync state"
      onClick={requestSyncStatus}
      icon={<Icon as={TfiReload} boxSize={"1.2em"} />}
    />}
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
