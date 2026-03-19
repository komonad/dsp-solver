export interface SolverPerfEntry {
  phase: 'graph' | 'model' | 'lp' | 'result' | 'total';
  durationMs: number;
  recipeCount?: number;
  optionCount?: number;
  constraintCount?: number;
  variableCount?: number;
  status?: string;
  recordedAt: number;
}

declare global {
  var __DSPCALC_SOLVER_PERF__: SolverPerfEntry[] | undefined;
}

const MAX_SOLVER_PERF_ENTRIES = 120;

function isPerfLoggingEnabled(): boolean {
  if (typeof globalThis === 'undefined') {
    return false;
  }

  try {
    const localStorageValue = (globalThis as { localStorage?: Storage }).localStorage?.getItem(
      'dspcalc.solverPerfLog'
    );
    if (localStorageValue === '1') {
      return true;
    }
  } catch {
    // ignore storage access failures
  }

  return false;
}

export function recordSolverPerf(entry: SolverPerfEntry): void {
  if (typeof globalThis === 'undefined') {
    return;
  }

  const store = (globalThis.__DSPCALC_SOLVER_PERF__ ??= []);
  store.push(entry);
  if (store.length > MAX_SOLVER_PERF_ENTRIES) {
    store.splice(0, store.length - MAX_SOLVER_PERF_ENTRIES);
  }

  if (entry.durationMs >= 20 || isPerfLoggingEnabled()) {
    const metrics = [
      `phase=${entry.phase}`,
      `duration=${entry.durationMs.toFixed(1)}ms`,
      entry.recipeCount !== undefined ? `recipes=${entry.recipeCount}` : '',
      entry.optionCount !== undefined ? `options=${entry.optionCount}` : '',
      entry.constraintCount !== undefined ? `constraints=${entry.constraintCount}` : '',
      entry.variableCount !== undefined ? `variables=${entry.variableCount}` : '',
      entry.status ? `status=${entry.status}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    console.info(`[solver-perf] ${metrics}`);
  }
}
