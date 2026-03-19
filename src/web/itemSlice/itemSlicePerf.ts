export type ItemSlicePerfPhase = 'open' | 'close';

export interface ItemSlicePerfEntry {
  phase: ItemSlicePerfPhase;
  itemId?: string;
  durationMs: number;
  recordedAt: number;
}

declare global {
  interface Window {
    __DSPCALC_ITEM_SLICE_PERF__?: ItemSlicePerfEntry[];
  }
}

const ITEM_SLICE_PERF_LIMIT = 100;
const PERF_LOG_STORAGE_KEY = 'dspcalc.perfLog';

export function recordItemSlicePerf(entry: ItemSlicePerfEntry): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextEntries = [...(window.__DSPCALC_ITEM_SLICE_PERF__ ?? []), entry].slice(
    -ITEM_SLICE_PERF_LIMIT
  );
  window.__DSPCALC_ITEM_SLICE_PERF__ = nextEntries;

  let shouldLog = entry.durationMs >= 80;
  try {
    shouldLog = shouldLog || window.localStorage.getItem(PERF_LOG_STORAGE_KEY) === '1';
  } catch {
    // Ignore browser storage failures for perf logging.
  }

  if (shouldLog) {
    const roundedDuration = Math.round(entry.durationMs * 10) / 10;
    const label = entry.itemId ? `${entry.phase}:${entry.itemId}` : entry.phase;
    console.info(`[item-slice-perf] ${label} ${roundedDuration}ms`);
  }
}
