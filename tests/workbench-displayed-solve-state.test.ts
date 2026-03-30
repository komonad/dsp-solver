import { buildDisplayedWorkbenchSolveState } from '../src/web/app/workbenchDisplayedSolveState';
import {
  buildIdleWorkbenchSolveState,
  type PersistedWorkbenchSolveState,
} from '../src/web/workbench/autoSolve';

test('buildDisplayedWorkbenchSolveState falls back to a matching settled persisted state', () => {
  const persistedState: PersistedWorkbenchSolveState = {
    request: {
      targets: [{ itemId: '1101', ratePerMin: 60 }],
      objective: 'min_buildings',
      balancePolicy: 'force_balance',
      rawInputItemIds: [],
    },
    result: null,
    error: '',
    activityStatus: 'settled',
    inputKey: 'matching-key',
  };

  expect(
    buildDisplayedWorkbenchSolveState({
      liveState: buildIdleWorkbenchSolveState(),
      persistedState,
      reusableInputKey: 'matching-key',
    })
  ).toMatchObject({
    request: persistedState.request,
    activity: {
      status: 'settled',
    },
  });
});

test('buildDisplayedWorkbenchSolveState keeps the live state when no reusable persisted solve exists', () => {
  const liveState = buildIdleWorkbenchSolveState();

  expect(
    buildDisplayedWorkbenchSolveState({
      liveState,
      persistedState: {
        request: {
          targets: [{ itemId: '1101', ratePerMin: 60 }],
          objective: 'min_buildings',
          balancePolicy: 'force_balance',
          rawInputItemIds: [],
        },
        result: null,
        error: '',
        activityStatus: 'settled',
        inputKey: 'other-key',
      },
      reusableInputKey: null,
    })
  ).toBe(liveState);
});
