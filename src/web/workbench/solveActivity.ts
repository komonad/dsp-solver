import type { AppLocale, LocaleBundle } from '../../i18n';
import type { WorkbenchSolveStage, WorkbenchSolveState } from './autoSolve';

export interface SolveActivityViewModel {
  title: string;
  description: string;
  elapsedLabel: string;
  engineLabel: string;
  chipLabel: string;
  stageLabel: string;
  stageDescription: string;
  resultBadgeLabel: string;
  staleResult: boolean;
  tone: 'info' | 'warning';
}

function resolveStageCopy(
  bundle: LocaleBundle,
  stage: WorkbenchSolveStage | undefined
): Pick<SolveActivityViewModel, 'stageLabel' | 'stageDescription'> {
  switch (stage) {
    case 'syncing_catalog':
      return {
        stageLabel: bundle.solveActivity.syncingCatalogLabel,
        stageDescription: bundle.solveActivity.syncingCatalogDescription,
      };
    case 'loading_solver':
      return {
        stageLabel: bundle.solveActivity.loadingSolverLabel,
        stageDescription: bundle.solveActivity.loadingSolverDescription,
      };
    case 'solving_primary':
      return {
        stageLabel: bundle.solveActivity.solvingPrimaryLabel,
        stageDescription: bundle.solveActivity.solvingPrimaryDescription,
      };
    case 'solving_relaxed':
      return {
        stageLabel: bundle.solveActivity.solvingRelaxedLabel,
        stageDescription: bundle.solveActivity.solvingRelaxedDescription,
      };
    case 'preparing_request':
    default:
      return {
        stageLabel: bundle.solveActivity.preparingRequestLabel,
        stageDescription: bundle.solveActivity.preparingRequestDescription,
      };
  }
}

function formatElapsedDuration(elapsedMs: number, locale: AppLocale): string {
  if (elapsedMs < 1000) {
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(Math.max(0, elapsedMs))} ms`;
  }

  const seconds = elapsedMs / 1000;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: seconds < 10 ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(seconds)} 秒`;
}

export function buildSolveActivityViewModel(params: {
  bundle: LocaleBundle;
  locale: AppLocale;
  solveState: WorkbenchSolveState;
  nowEpochMs: number;
}): SolveActivityViewModel | null {
  const { bundle, locale, solveState, nowEpochMs } = params;
  if (
    (solveState.activity.status !== 'running' && solveState.activity.status !== 'cancelled') ||
    typeof solveState.activity.startedAtEpochMs !== 'number'
  ) {
    return null;
  }

  const elapsedFinishedAt = solveState.activity.finishedAtEpochMs ?? nowEpochMs;
  const elapsedMs = Math.max(0, elapsedFinishedAt - solveState.activity.startedAtEpochMs);
  const staleResult = solveState.activity.staleResult;
  const stageCopy = resolveStageCopy(bundle, solveState.activity.stage);
  const cancelled = solveState.activity.status === 'cancelled';

  return {
    title: cancelled
      ? staleResult
        ? bundle.solveActivity.cancelledRefreshingTitle
        : bundle.solveActivity.cancelledInitialTitle
      : staleResult
        ? bundle.solveActivity.refreshingTitle
        : bundle.solveActivity.initialSolveTitle,
    description: cancelled
      ? staleResult
        ? bundle.solveActivity.cancelledRefreshingDescription
        : bundle.solveActivity.cancelledInitialDescription
      : staleResult
        ? bundle.solveActivity.refreshingDescription
        : bundle.solveActivity.initialSolveDescription,
    elapsedLabel: bundle.solveActivity.elapsedLabel(
      formatElapsedDuration(elapsedMs, locale)
    ),
    engineLabel: bundle.solveActivity.engineLabel,
    chipLabel: cancelled
      ? bundle.solveActivity.cancelledChipLabel
      : bundle.solveActivity.runningChipLabel,
    stageLabel: cancelled ? bundle.solveActivity.cancelledStageLabel : stageCopy.stageLabel,
    stageDescription: cancelled
      ? bundle.solveActivity.cancelledStageDescription(stageCopy.stageLabel)
      : stageCopy.stageDescription,
    resultBadgeLabel: staleResult
      ? bundle.solveActivity.staleResultBadge
      : bundle.solveActivity.pendingResultBadge,
    staleResult,
    tone: cancelled ? 'warning' : staleResult ? 'warning' : 'info',
  };
}
