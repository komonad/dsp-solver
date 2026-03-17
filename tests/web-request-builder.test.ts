import { buildWorkbenchRequest, parseAdvancedSolveOverrides } from '../src/web/requestBuilder';

test('buildWorkbenchRequest merges base request fields with advanced overrides', () => {
  const request = buildWorkbenchRequest({
    targets: [
      { itemId: '1101', ratePerMin: 60 },
      { itemId: '', ratePerMin: 10 },
    ],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1001'],
    advancedOverrides: {
      disabledRecipeIds: ['1'],
      preferredBuildingByRecipe: { '2': '5002' },
    },
  });

  expect(request).toEqual({
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings',
    balancePolicy: 'force_balance',
    rawInputItemIds: ['1001'],
    disabledRecipeIds: ['1'],
    preferredBuildingByRecipe: { '2': '5002' },
  });
});

test('parseAdvancedSolveOverrides accepts supported override fields', () => {
  const parsed = parseAdvancedSolveOverrides(`{
    "disabledRecipeIds": ["1"],
    "disabledBuildingIds": ["5001"],
    "forcedBuildingByRecipe": { "2": "5002" },
    "preferredProliferatorModeByRecipe": { "2": "speed" },
    "forcedProliferatorLevelByRecipe": { "2": 3 }
  }`);

  expect(parsed.error).toBe('');
  expect(parsed.value).toEqual({
    disabledRecipeIds: ['1'],
    disabledBuildingIds: ['5001'],
    forcedBuildingByRecipe: { '2': '5002' },
    preferredProliferatorModeByRecipe: { '2': 'speed' },
    forcedProliferatorLevelByRecipe: { '2': 3 },
  });
});

test('parseAdvancedSolveOverrides rejects invalid payloads with a readable error', () => {
  expect(parseAdvancedSolveOverrides('[]')).toEqual({
    value: {},
    error: 'Advanced overrides must be a JSON object.',
  });

  expect(parseAdvancedSolveOverrides('{')).toEqual({
    value: {},
    error: expect.stringContaining('Invalid JSON:'),
  });

  expect(
    parseAdvancedSolveOverrides(`{
      "disabledRecipeIds": [1],
      "preferredProliferatorModeByRecipe": { "2": "turbo" }
    }`)
  ).toEqual({
    value: {},
    error:
      'disabledRecipeIds must be a string array when present. preferredProliferatorModeByRecipe must be an object whose values are one of none, speed, or productivity.',
  });
});
