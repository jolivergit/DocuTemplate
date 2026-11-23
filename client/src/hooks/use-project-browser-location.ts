import { useSyncExternalStore } from "react";
import { navigate, type useBrowserLocation } from "wouter/use-browser-location";
import { initializeProjectHistoryTracking } from "../lib/project-history";

const subscribe = (listener: () => void) => initializeProjectHistoryTracking().subscribe(listener);
const pathname = () => initializeProjectHistoryTracking().pathname();

/** Router snapshots stay on the accepted page while a cancelled pop is repaired. */
export function useProjectBrowserLocation(): ReturnType<typeof useBrowserLocation> {
  return [useSyncExternalStore(subscribe, pathname, pathname), navigate];
}
