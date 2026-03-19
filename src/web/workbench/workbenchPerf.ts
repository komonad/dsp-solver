export interface WorkbenchPerfEntry {
  phase: 'solve' | 'presentation';
  status?: string;
  durationMs: number;
  requestBuildMs?: number;
  solveMs?: number;
  recordedAt: number;
}

declare global {
  interface Window {
    __DSPCALC_WORKBENCH_PERF__?: WorkbenchPerfEntry[];
  }
}

const PERF_LIMIT = 120;
const PERF_LOG_STORAGE_KEY = 'dspcalc.perfLog';

export function recordWorkbenchPerf(entry: WorkbenchPerfEntry): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextEntries = [...(window.__DSPCALC_WORKBENCH_PERF__ ?? []), entry].slice(-PERF_LIMIT);
  window.__DSPCALC_WORKBENCH_PERF__ = nextEntries;

  let shouldLog = entry.durationMs >= 40;
  try {
    shouldLog = shouldLog || window.localStorage.getItem(PERF_LOG_STORAGE_KEY) === '1';
  } catch {
    // Ignore storage access failures in perf logging.
  }

  if (shouldLog) {
    const rounded = Math.round(entry.durationMs * 10) / 10;
    const requestBuildMs =
      entry.requestBuildMs !== undefined ? ` request=${Math.round(entry.requestBuildMs * 10) / 10}ms` : '';
    const solveMs =
      entry.solveMs !== undefined ? ` solve=${Math.round(entry.solveMs * 10) / 10}ms` : '';
    const status = entry.status ? ` status=${entry.status}` : '';
    console.info(`[workbench-perf] ${entry.phase} ${rounded}ms${requestBuildMs}${solveMs}${status}`);
  }
}
