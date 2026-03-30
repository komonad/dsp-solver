import { getLocaleBundle } from '../src/i18n';
import {
  buildCancelledWorkbenchSolveState,
  buildIdleWorkbenchSolveState,
  buildRunningWorkbenchSolveState,
  type WorkbenchSolveState,
} from '../src/web/workbench/autoSolve';
import { buildSolveActivityViewModel } from '../src/web/workbench/solveActivity';

function buildSettledStateWithResult(): WorkbenchSolveState {
  return {
    ...buildIdleWorkbenchSolveState(),
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    result: {
      status: 'optimal',
      resolvedRawInputItemIds: [],
      targets: [],
      recipePlans: [],
      externalInputs: [],
      surplusOutputs: [],
      buildingSummary: [],
      powerSummary: {
        totalPowerMW: 0,
        roundedUpPowerMW: 0,
      },
      itemBalance: [],
      diagnostics: {
        messages: [],
        infoMessages: [],
        unmetPreferences: [],
      },
    } as unknown as WorkbenchSolveState['result'],
    activity: {
      status: 'settled',
      finishedAtEpochMs: 1_000,
      staleResult: false,
    },
  };
}

test('buildRunningWorkbenchSolveState marks whether the current result becomes stale', () => {
  const nextState = buildRunningWorkbenchSolveState(buildSettledStateWithResult(), {
    startedAtEpochMs: 2_000,
    stage: 'solving_primary',
  });

  expect(nextState.activity.status).toBe('running');
  expect(nextState.activity.startedAtEpochMs).toBe(2_000);
  expect(nextState.activity.staleResult).toBe(true);
  expect(nextState.activity.stage).toBe('solving_primary');
  expect(nextState.error).toBe('');
});

test('buildSolveActivityViewModel describes refreshing an older completed result', () => {
  const bundle = getLocaleBundle();
  const solveState = buildRunningWorkbenchSolveState(buildSettledStateWithResult(), {
    startedAtEpochMs: 1_000,
    stage: 'syncing_catalog',
  });

  const viewModel = buildSolveActivityViewModel({
    bundle,
    locale: 'zh-CN',
    solveState,
    nowEpochMs: 2_250,
  });

  expect(viewModel).toMatchObject({
    title: bundle.solveActivity.refreshingTitle,
    description: bundle.solveActivity.refreshingDescription,
    chipLabel: bundle.solveActivity.runningChipLabel,
    stageLabel: bundle.solveActivity.syncingCatalogLabel,
    stageDescription: bundle.solveActivity.syncingCatalogDescription,
    resultBadgeLabel: bundle.solveActivity.staleResultBadge,
    staleResult: true,
  });
  expect(viewModel?.elapsedLabel).toContain('1.3 秒');
});

test('buildSolveActivityViewModel describes the initial in-flight solve before any result exists', () => {
  const bundle = getLocaleBundle();
  const solveState = buildRunningWorkbenchSolveState(buildIdleWorkbenchSolveState(), {
    startedAtEpochMs: 5_000,
    stage: 'preparing_request',
  });

  const viewModel = buildSolveActivityViewModel({
    bundle,
    locale: 'zh-CN',
    solveState,
    nowEpochMs: 5_420,
  });

  expect(viewModel).toMatchObject({
    title: bundle.solveActivity.initialSolveTitle,
    description: bundle.solveActivity.initialSolveDescription,
    stageLabel: bundle.solveActivity.preparingRequestLabel,
    stageDescription: bundle.solveActivity.preparingRequestDescription,
    resultBadgeLabel: bundle.solveActivity.pendingResultBadge,
    staleResult: false,
  });
  expect(viewModel?.elapsedLabel).toContain('420 ms');
});

test('buildCancelledWorkbenchSolveState preserves the in-flight request while marking the run as cancelled', () => {
  const runningState = buildRunningWorkbenchSolveState(buildSettledStateWithResult(), {
    startedAtEpochMs: 3_000,
    stage: 'solving_primary',
    activeRequest: {
      targets: [{ itemId: '6006', ratePerMin: 60 }],
      objective: 'min_power',
      balancePolicy: 'force_balance',
      rawInputItemIds: ['1006'],
    },
  });

  const cancelledState = buildCancelledWorkbenchSolveState(runningState);

  expect(cancelledState.activity.status).toBe('cancelled');
  expect(cancelledState.activity.stage).toBe('solving_primary');
  expect(cancelledState.activity.staleResult).toBe(true);
  expect(cancelledState.activeRequest).toEqual(runningState.activeRequest);
  expect(cancelledState.request).toEqual(runningState.request);
});

test('buildSolveActivityViewModel describes a cancelled refresh with a stale result', () => {
  const bundle = getLocaleBundle();
  const runningState = buildRunningWorkbenchSolveState(buildSettledStateWithResult(), {
    startedAtEpochMs: 8_000,
    stage: 'solving_relaxed',
  });
  const solveState = buildCancelledWorkbenchSolveState(runningState);
  solveState.activity.finishedAtEpochMs = 9_550;

  const viewModel = buildSolveActivityViewModel({
    bundle,
    locale: 'zh-CN',
    solveState,
    nowEpochMs: 12_000,
  });

  expect(viewModel).toMatchObject({
    title: bundle.solveActivity.cancelledRefreshingTitle,
    description: bundle.solveActivity.cancelledRefreshingDescription,
    chipLabel: bundle.solveActivity.cancelledChipLabel,
    stageLabel: bundle.solveActivity.cancelledStageLabel,
    resultBadgeLabel: bundle.solveActivity.staleResultBadge,
    staleResult: true,
    tone: 'warning',
  });
  expect(viewModel?.stageDescription).toContain(bundle.solveActivity.solvingRelaxedLabel);
  expect(viewModel?.elapsedLabel).toContain('1.6 秒');
});

test('buildSolveActivityViewModel returns null once the solve is no longer running', () => {
  const bundle = getLocaleBundle();

  expect(
    buildSolveActivityViewModel({
      bundle,
      locale: 'zh-CN',
      solveState: buildIdleWorkbenchSolveState(),
      nowEpochMs: 10_000,
    })
  ).toBeNull();
});
