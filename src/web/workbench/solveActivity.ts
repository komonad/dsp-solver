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
    case 'optimizing_recipe_count':
      return { stageLabel: '产线种类优化 · MILP', stageDescription: '先显示可行方案，后台继续搜索，达到目标差距后结束；可随时停止并保留方案。' };
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
  const hasCurrentSolution = Boolean(solveState.result) && !staleResult;

  return {
    title: cancelled
      ? staleResult
        ? bundle.solveActivity.cancelledRefreshingTitle
        : bundle.solveActivity.cancelledInitialTitle
      : hasCurrentSolution ? '当前方案可用 · 后台优化中' : staleResult
        ? bundle.solveActivity.refreshingTitle
        : bundle.solveActivity.initialSolveTitle,
    description: cancelled
      ? staleResult
        ? bundle.solveActivity.cancelledRefreshingDescription
        : bundle.solveActivity.cancelledInitialDescription
      : hasCurrentSolution ? '当前方案满足约束；后台持续搜索改进方案，可随时停止并保留结果。' : staleResult
        ? bundle.solveActivity.refreshingDescription
        : bundle.solveActivity.initialSolveDescription,
    elapsedLabel: bundle.solveActivity.elapsedLabel(
      formatElapsedDuration(elapsedMs, locale)
    ),
    engineLabel: solveState.activity.stage === 'optimizing_recipe_count' ? 'HiGHS · 后台 MILP' : bundle.solveActivity.engineLabel,
    chipLabel: cancelled
      ? bundle.solveActivity.cancelledChipLabel
      : bundle.solveActivity.runningChipLabel,
    stageLabel: cancelled ? bundle.solveActivity.cancelledStageLabel : stageCopy.stageLabel,
    stageDescription: cancelled
      ? bundle.solveActivity.cancelledStageDescription(stageCopy.stageLabel)
      : stageCopy.stageDescription,
    resultBadgeLabel: hasCurrentSolution ? '当前最佳可行方案' : staleResult
      ? bundle.solveActivity.staleResultBadge
      : bundle.solveActivity.pendingResultBadge,
    staleResult,
    tone: cancelled ? 'warning' : staleResult ? 'warning' : 'info',
  };
}
