import {
  loadResolvedCatalogFromFiles,
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import {
  solveCatalogRequest,
  solveCatalogRequestAsync,
  type SolveResult,
  type SolverImplementation,
} from '../src/solver';
import { loadHighsSolverImplementation } from '../src/solver/experimental';

const workEnergyForOneMW = 1_000_000 / 60;

function buildDefaults(): CatalogDefaultConfigSpec {
  return {
    buildingRules: [{ ID: 5001, Category: 'smelter' }],
    recipeModifierRules: [{ Code: 0, Kind: 'none', SupportedModes: ['none'], MaxLevel: 0 }],
    recommendedRawItemTypeIds: [1],
  };
}

function buildDirectRecipeDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Plate', IconName: 'plate', GridIndex: 2 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Smelter',
        IconName: 'smelter',
        GridIndex: 3,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Plate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'plate',
      },
    ],
  };
}

function buildComplexityDataset(): VanillaDatasetSpec {
  return {
    items: [
      { ID: 1001, Type: 1, Name: 'Ore', IconName: 'ore', GridIndex: 1 },
      { ID: 1101, Type: 2, Name: 'Target', IconName: 'target', GridIndex: 2 },
      { ID: 1201, Type: 2, Name: 'Intermediate', IconName: 'intermediate', GridIndex: 3 },
      {
        ID: 5001,
        Type: 6,
        Name: 'Assembler',
        IconName: 'assembler',
        GridIndex: 4,
        Speed: 1,
        WorkEnergyPerTick: workEnergyForOneMW,
      },
    ],
    recipes: [
      {
        ID: 1,
        Type: 1,
        Factories: [5001],
        Name: 'Direct',
        Items: [1001],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'target',
      },
      {
        ID: 2,
        Type: 1,
        Factories: [5001],
        Name: 'Ore to Intermediate',
        Items: [1001],
        ItemCounts: [1],
        Results: [1201],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'intermediate',
      },
      {
        ID: 3,
        Type: 1,
        Factories: [5001],
        Name: 'Intermediate to Target',
        Items: [1201],
        ItemCounts: [1],
        Results: [1101],
        ResultCounts: [1],
        TimeSpend: 60,
        Proliferator: 0,
        IconName: 'target',
      },
    ],
  };
}

test('cached solve results are isolated by solver implementation id', () => {
  const catalog = resolveCatalogModel(buildDirectRecipeDataset(), buildDefaults());
  const request = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings' as const,
    balancePolicy: 'force_balance' as const,
  };
  const impossibleImplementation: SolverImplementation = {
    implementationId: 'impossible',
    solve<_ConstraintName extends string = string, VariableName extends string = string>() {
      return {
        status: 'infeasible',
        result: Number.NaN,
        variables: new Map<VariableName, number>(),
      };
    },
  };

  const impossibleResult = solveCatalogRequest(catalog, request, {
    implementation: impossibleImplementation,
  });
  const defaultResult = solveCatalogRequest(catalog, request);

  expect(impossibleResult.status).toBe('infeasible');
  expect(defaultResult.status).toBe('optimal');
  expect(defaultResult.recipePlans).toHaveLength(1);
});

test('async solve entry can use the HiGHS implementation promise', async () => {
  const catalog = resolveCatalogModel(buildDirectRecipeDataset(), buildDefaults());
  const request = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_buildings' as const,
    balancePolicy: 'force_balance' as const,
  };

  const result = await solveCatalogRequestAsync(catalog, request, {
    implementationPromise: loadHighsSolverImplementation(),
  });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans).toHaveLength(1);
  expect(result.recipePlans[0].recipeId).toBe('1');
  expect(result.externalInputs).toEqual([{ itemId: '1001', ratePerMin: 60 }]);
});

test('HiGHS implementation handles the min_complexity MILP path', async () => {
  const catalog = resolveCatalogModel(buildComplexityDataset(), buildDefaults());
  const request = {
    targets: [{ itemId: '1101', ratePerMin: 60 }],
    objective: 'min_complexity' as const,
    balancePolicy: 'force_balance' as const,
  };
  const implementation = await loadHighsSolverImplementation();

  const result = solveCatalogRequest(catalog, request, { implementation });

  expect(result.status).toBe('optimal');
  expect(result.recipePlans.map(plan => plan.recipeId)).toEqual(['1']);
  expect(result.solveAudit?.attempts.some(attempt => attempt.phase === 'complexity_milp')).toBe(true);
});

test('default HiGHS implementation solves the wrapped OrbitalRing min_power LP', async () => {
  const catalog = await loadResolvedCatalogFromFiles('./data/OrbitalRing.json', './data/OrbitalRing.defaults.json');
  const implementation = await loadHighsSolverImplementation();

  let result: unknown = null;
  expect(() => {
    result = solveCatalogRequest(catalog, {
      targets: [{ itemId: '1403', ratePerMin: 60 }],
      objective: 'min_power',
      balancePolicy: 'force_balance',
      autoPromoteUnavailableItemsToRawInputs: true,
      rawInputItemIds: [],
      disabledRecipeIds: ['510', '517', '705', '776'],
      disabledBuildingIds: ['6215'],
      allowedRecipesByItem: {
        '7009': ['16'],
      },
    }, { implementation });
  }).not.toThrow();

  const solveResult = result as SolveResult | null;
  expect(solveResult).not.toBeNull();
  if (solveResult === null) {
    throw new Error('Expected HiGHS solve result to be captured.');
  }
  expect(solveResult.status).toBe('optimal');
  expect(solveResult.solveAudit?.attempts[0]?.status).toBe('optimal');
});

test('HiGHS allow_surplus solve keeps the LP candidate when surplus MILP refinement aborts', async () => {
  const catalog = await loadResolvedCatalogFromFiles('./data/OrbitalRing.json', './data/OrbitalRing.defaults.json');
  const implementation = await loadHighsSolverImplementation();

  let result: unknown = null;
  expect(() => {
    result = solveCatalogRequest(catalog, {
      targets: [{ itemId: '6006', ratePerMin: 60 }],
      objective: 'min_power',
      balancePolicy: 'allow_surplus',
      autoPromoteUnavailableItemsToRawInputs: true,
      rawInputItemIds: [],
      disabledRecipeIds: ['510', '517', '705', '776'],
      disabledBuildingIds: ['6215'],
      allowedRecipesByItem: {
        '7009': ['16'],
      },
    }, { implementation });
  }).not.toThrow();

  const solveResult = result as SolveResult | null;
  expect(solveResult).not.toBeNull();
  if (solveResult === null) {
    throw new Error('Expected HiGHS solve result to be captured.');
  }
  expect(solveResult.status).toBe('optimal');
  expect(
    solveResult.solveAudit?.attempts.some(
      attempt =>
        attempt.phase === 'surplus_type_milp' || attempt.phase === 'surplus_complexity_milp'
    )
  ).toBe(true);
  expect(solveResult.surplusOutputs.every(entry => Math.abs(entry.ratePerMin) >= 0.005)).toBe(true);
  expect(solveResult.surplusOutputs.map(entry => entry.itemId)).not.toContain('1102');
  expect(solveResult.itemBalance.find(entry => entry.itemId === '1102')?.netRatePerMin ?? 0).toBe(0);
});
