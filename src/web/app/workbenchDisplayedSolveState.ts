import {
  restoreWorkbenchSolveState,
  type PersistedWorkbenchSolveState,
  type WorkbenchSolveState,
} from '../workbench/autoSolve';

function hasMeaningfulWorkbenchSolveState(state: WorkbenchSolveState): boolean {
  return Boolean(
    state.request ||
      state.activeRequest ||
      state.result ||
      state.error ||
      state.fallback ||
      state.activity.status !== 'idle'
  );
}

export function buildDisplayedWorkbenchSolveState(params: {
  liveState: WorkbenchSolveState;
  persistedState?: PersistedWorkbenchSolveState | null;
  reusableInputKey?: string | null;
}): WorkbenchSolveState {
  const { liveState, persistedState, reusableInputKey } = params;

  if (
    hasMeaningfulWorkbenchSolveState(liveState) ||
    !persistedState ||
    persistedState.activityStatus !== 'settled' ||
    !reusableInputKey
  ) {
    return liveState;
  }

  return restoreWorkbenchSolveState(persistedState);
}
