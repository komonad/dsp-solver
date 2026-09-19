import { computeFocusFilter, type PresentationRecipePlan } from '../src/presentation';
import { buildFocusItemOptions, splitByFocus } from '../src/web/app/workbenchHelpers';

function plan(recipeId: string, inputs: string[], outputs: string[], overrides: Partial<PresentationRecipePlan> = {}): PresentationRecipePlan {
  const rate = (itemId: string) => ({ itemId, itemName: itemId, ratePerMin: 60 });
  return {
    recipeId, recipeName: recipeId, buildingId: 'assembler', buildingName: 'Assembler',
    proliferatorLevel: 0, proliferatorMode: 'none', proliferatorLabel: '',
    runsPerMin: 60, exactBuildingCount: 1.5, roundedUpBuildingCount: 2,
    activePowerMW: 0.5, roundedPlacementPowerMW: 0.75,
    inputs: inputs.map(rate), outputs: outputs.map(rate), ...overrides,
  };
}

describe('current production focus', () => {
  const plans = [
    plan('smelt', ['ore'], ['plate']),
    plan('gear', ['plate'], ['gear']),
    plan('circuit', ['plate', 'copper'], ['circuit']),
  ];

  it('cuts power supply without dimming materials shared with the product', () => {
    const source = [
      plan('antimatter', ['photon', 'power'], ['antimatter']),
      plan('fuel', ['antimatter', 'shell', 'power'], ['fuel']),
      plan('generate', ['fuel'], ['power']),
      plan('white', ['antimatter', 'matrix', 'power'], ['white']),
      plan('shell', ['ore', 'power'], ['shell']),
    ];
    const before = JSON.stringify(source);
    const options = { viewRawInputItemIds: ['power'], targetItemIds: ['white'] };
    for (const selected of [['white'], []]) {
      const result = computeFocusFilter(selected, source, new Set(['photon', 'matrix', 'ore']), options);
      expect(result.focusedRecipeIndices).toEqual(new Set([0, 3]));
      expect(result.focusedItemIds).toEqual(new Set(['white', 'antimatter', 'photon', 'matrix', 'power']));
      expect(result.summary).toEqual({ recipeCount: 2, buildingCount: 4, roundedPlacementPowerMW: 1.5 });
    }
    expect(JSON.stringify(source)).toBe(before);
  });

  it('works without focus and preserves unrelated branches', () => {
    const source = [...plans, plan('plastic', ['oil'], ['plastic'])];
    const result = computeFocusFilter([], source, new Set(['ore', 'oil']), { viewRawInputItemIds: ['plate'] });
    expect(result.focusedRecipeIndices).toEqual(new Set([1, 2, 3]));
    expect(result.focusedItemIds.has('ore')).toBe(false);
    expect(result.focusedItemIds.has('plate')).toBe(true);
  });

  it('retains upstream capacity shared with another downstream branch', () => {
    const result = computeFocusFilter([], plans, new Set(['ore']), { viewRawInputItemIds: ['gear'] });
    expect(result.focusedRecipeIndices).toEqual(new Set([0, 2]));
    expect(result.focusedItemIds.has('ore')).toBe(true);
  });

  it('retains a co-product producer when a remaining branch still needs it', () => {
    const source = [
      plan('refine', ['crude'], ['oil', 'hydrogen']),
      plan('fuel', ['hydrogen'], ['fuel']),
      plan('plastic', ['oil'], ['plastic']),
    ];
    const result = computeFocusFilter([], source, new Set(['crude']), { viewRawInputItemIds: ['hydrogen'] });
    expect(result.focusedRecipeIndices).toEqual(new Set([0, 1, 2]));
  });

  it('lets view boundaries take precedence over focus and supports multiple boundaries', () => {
    const options = { viewRawInputItemIds: ['gear', 'copper'] };
    const direct = computeFocusFilter(['gear'], plans, new Set(), options);
    expect(direct.focusedRecipeIndices.size).toBe(0);
    expect(direct.focusedItemIds).toEqual(new Set(['gear']));
    const union = computeFocusFilter(['gear', 'circuit'], plans, new Set(), options);
    expect(union.focusedRecipeIndices).toEqual(new Set([0, 2]));
    expect(union.viewRawInputItemIds).toEqual(new Set(['gear', 'copper']));
    expect(computeFocusFilter(['gear'], plans, new Set()).focusedRecipeIndices).toEqual(new Set([0, 1]));
  });

  it('keeps target production reachable after cutting a cyclic dependency', () => {
    const source = [plan('a', ['b'], ['a']), plan('b', ['a'], ['b'])];
    const result = computeFocusFilter([], source, new Set(), { viewRawInputItemIds: ['b'], targetItemIds: ['a'] });
    expect(result.focusedRecipeIndices).toEqual(new Set([0]));
  });

  it('selects upstream plans without following shared inputs downstream', () => {
    const result = computeFocusFilter(['gear'], plans, new Set(['ore', 'copper']));
    expect(result.focusedRecipeIndices).toEqual(new Set([0, 1]));
    expect(result.focusedItemIds).toEqual(new Set(['ore', 'plate', 'gear']));
    expect(result.summary).toEqual({ recipeCount: 2, buildingCount: 4, roundedPlacementPowerMW: 1.5 });
  });

  it('unions selections without double-counting shared plans or recipe variants', () => {
    const variants = [...plans, plan('smelt', ['ore'], ['plate'])];
    const result = computeFocusFilter(['gear', 'circuit', 'gear'], variants, new Set(['ore', 'copper']));
    expect(result.focusedRecipeIndices).toEqual(new Set([0, 1, 2, 3]));
    expect(result.summary).toEqual({ recipeCount: 3, buildingCount: 8, roundedPlacementPowerMW: 3 });
  });

  it('stops at raw inputs including a directly selected raw item', () => {
    expect(computeFocusFilter(['gear'], plans, new Set(['plate'])).focusedRecipeIndices).toEqual(new Set([1]));
    const raw = computeFocusFilter(['plate'], plans, new Set(['plate']));
    expect(raw.focusedRecipeIndices.size).toBe(0);
    expect(raw.focusedItemIds).toEqual(new Set(['plate']));
  });

  it('includes co-products without traversing their other producers or consumers', () => {
    const result = computeFocusFilter(['oil'], [
      plan('refine', ['crude'], ['oil', 'hydrogen']),
      plan('hydrogen', ['ice'], ['hydrogen']),
      plan('fuel', ['hydrogen'], ['fuel']),
    ], new Set(['crude', 'ice']));
    expect(result.focusedRecipeIndices).toEqual(new Set([0]));
    expect(result.focusedItemIds).toEqual(new Set(['oil', 'crude', 'hydrogen']));
  });

  it('traverses co-products when they are also required inputs and terminates cycles', () => {
    const result = computeFocusFilter(['a'], [
      plan('a', ['b'], ['a', 'c']),
      plan('b', ['c'], ['b']),
      plan('c', ['a', 'ore'], ['c']),
    ], new Set(['ore']));
    expect(result.focusedRecipeIndices).toEqual(new Set([0, 1, 2]));
    expect(result.focusedItemIds).toEqual(new Set(['a', 'b', 'c', 'ore']));
  });

  it('ignores negligible flows and preserves the source quantities and order', () => {
    const source = [plan('trace', ['ore'], ['trace'], {
      outputs: [{ itemId: 'trace', itemName: 'Trace', ratePerMin: 1e-9 }],
    }), ...plans];
    const before = JSON.stringify(source);
    expect(computeFocusFilter(['trace'], source, new Set()).focusedRecipeIndices.size).toBe(0);
    computeFocusFilter(['gear'], source, new Set());
    expect(JSON.stringify(source)).toBe(before);
    expect(computeFocusFilter([], source, new Set()).summary.buildingCount).toBe(0);
  });

  it('supports an external-only item without recipes', () => {
    const result = computeFocusFilter(['ore'], [], new Set(['ore']));
    expect(result.focusedItemIds).toEqual(new Set(['ore']));
    expect(result.summary).toEqual({ recipeCount: 0, buildingCount: 0, roundedPlacementPowerMW: 0 });
  });

  it('offers only unselected items in the current production line', () => {
    const items = ['ore', 'gear', 'unused'].map(itemId => ({ itemId, name: itemId }));
    expect(buildFocusItemOptions(items, new Set(['ore', 'gear']), new Set(['gear']))).toEqual([items[0]]);
    expect(buildFocusItemOptions(items, new Set(), new Set())).toEqual([]);
  });

  it('keeps original order and values within each display group', () => {
    const focus = computeFocusFilter(['gear'], plans, new Set());
    const groups = splitByFocus(plans, (_, index) => focus.focusedRecipeIndices.has(index));
    expect(groups.focused).toEqual([plans[0], plans[1]]);
    expect(groups.unfocused).toEqual([plans[2]]);
    expect(groups.focused[0]).toBe(plans[0]);
  });
});
