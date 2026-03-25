import {
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { buildPresentationModel } from '../src/presentation';
import { solveCatalogRequest } from '../src/solver';

function workEnergyForMW(megawatts: number): number {
  return (megawatts * 1_000_000) / 60;
}

function buildOrderingDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Demo Ore', IconName: 'demo-ore' },
      { ID: 1101, Type: 2, Name: 'Demo Ingot', IconName: 'demo-ingot' },
      { ID: 1201, Type: 2, Name: 'Demo Gear', IconName: 'demo-gear' },
      { ID: 1301, Type: 2, Name: 'Demo Circuit', IconName: 'demo-circuit' },
      { ID: 1401, Type: 2, Name: 'Demo Final', IconName: 'demo-final' },
      {
        ID: 5001,
        Type: 6,
        Name: 'Demo Assembler',
        IconName: 'demo-assembler',
        Speed: 1,
        WorkEnergyPerTick: workEnergyForMW(1),
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Ingot',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'demo-ingot',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Ingot to Gear',
        Items: [1101],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'demo-gear',
      },
      {
        ID: 3,
        Type: 1,
        Factories: [5001],
        Name: 'Ingot to Circuit',
        Items: [1101],
        ItemCounts: [1],
        Results: [1301],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'demo-circuit',
      },
      {
        ID: 4,
        Type: 1,
        Factories: [5001],
        Name: 'Gear and Circuit to Final',
        Items: [1201, 1301],
        ItemCounts: [1, 1],
        Results: [1401],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'demo-final',
      },
    ],
  };
}

function buildOrderingDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'factory' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

test('presentation recipe plans prefer target-adjacent recipes before raw-adjacent recipes', () => {
  const catalog = resolveCatalogModel(buildOrderingDataset(), buildOrderingDefaults());
  const request = {
    targets: [{ itemId: '1401', ratePerMin: 60 }],
    objective: 'min_buildings' as const,
    balancePolicy: 'force_balance' as const,
    rawInputItemIds: [],
  };
  const solveResult = solveCatalogRequest(catalog, request);
  const result = {
    ...solveResult,
    recipePlans: solveResult.recipePlans.slice().reverse(),
  };

  const model = buildPresentationModel({ catalog, request, result });

  expect(model.recipePlans.map(plan => plan.recipeId)).toEqual(['4', '2', '3', '1']);
  expect(model.recipePlans[0].outputs.some(output => output.itemId === '1401')).toBe(true);
  expect(model.recipePlans.at(-1)?.inputs.some(input => input.itemId === '1001')).toBe(true);
});

test('presentation recipe plans prioritize heavier target branches within the same dependency layer', () => {
  const catalog = resolveCatalogModel(buildOrderingDataset(), buildOrderingDefaults());
  const request = {
    targets: [
      { itemId: '1301', ratePerMin: 60 },
      { itemId: '1201', ratePerMin: 120 },
    ],
    objective: 'min_buildings' as const,
    balancePolicy: 'force_balance' as const,
    rawInputItemIds: [],
  };
  const solveResult = solveCatalogRequest(catalog, request);
  const result = {
    ...solveResult,
    recipePlans: solveResult.recipePlans.slice().reverse(),
  };

  const model = buildPresentationModel({ catalog, request, result });

  expect(model.recipePlans.map(plan => plan.recipeId)).toEqual(['2', '3', '1']);
  expect(model.recipePlans[0].outputs.some(output => output.itemId === '1201')).toBe(true);
  expect(model.recipePlans[1].outputs.some(output => output.itemId === '1301')).toBe(true);
});
