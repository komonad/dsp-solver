import { loadGameDataFromFile } from '../src/legacy/data/loader';
import { solveMultiDemand } from '../src/legacy/core/multiDemandSolver';
import { buildDisplayRecipeRows, calculateDisplayIoRates } from '../src/legacy/web/displayModel';
import type { GameData, Recipe, Building } from '../src/legacy/types';

describe('display model', () => {
  let gameData: GameData;
  let testGameData: GameData;

  beforeAll(async () => {
    gameData = await loadGameDataFromFile('./data/Vanilla.json');
    testGameData = await loadGameDataFromFile('./data/TestConfig.json');
  });

  test('universe matrix 60/min does not inflate lab counts by recipe speed', () => {
    const result = solveMultiDemand(
      [{ itemId: '6006', rate: 60 }],
      gameData
    );

    expect(result.feasible).toBe(true);

    const rows = buildDisplayRecipeRows(
      result,
      gameData,
      (recipe: Recipe) => gameData.buildings.find(b => b.originalId === recipe.factoryIds[0] || b.id === String(recipe.factoryIds[0])),
      (_recipe: Recipe, _building: Building | undefined) => ({ level: 0, mode: 'none' })
    );

    const universeRow = rows.find(row => row.outputItemId === '6006');
    expect(universeRow).toBeDefined();
    expect(universeRow!.displayedBuildingCount).toBeLessThan(100);
  });

  test('fullerene-silver display rows show productive chemical buildings', () => {
    const result = solveMultiDemand(
      [{ itemId: '11005', rate: 60 }],
      testGameData,
      {
        recipeBuildings: new Map([
          ['1', '2304'],
          ['2', '2304'],
          ['90001', '2309'],
          ['90002', '2309'],
          ['90003', '2314'],
          ['90004', '2314'],
        ]),
      }
    );

    expect(result.feasible).toBe(true);

    const rows = buildDisplayRecipeRows(
      result,
      testGameData,
      (recipe: Recipe) => {
        const buildingId = new Map([
          ['1', '2304'],
          ['2', '2304'],
          ['90001', '2309'],
          ['90002', '2309'],
          ['90003', '2314'],
          ['90004', '2314'],
        ]).get(recipe.id);
        return testGameData.buildings.find(b => b.id === buildingId);
      },
      (_recipe: Recipe, _building: Building | undefined) => ({ level: 0, mode: 'none' })
    );

    const fullereneSilverRow = rows.find(row => row.recipeId === '90003');
    const fullerolRow = rows.find(row => row.recipeId === '90004');

    expect(fullereneSilverRow?.buildingName).toBe('量子化工厂');
    expect(fullerolRow?.buildingName).toBe('量子化工厂');
    expect(fullereneSilverRow?.displayedBuildingCount).toBe(40);
    expect(fullerolRow?.displayedBuildingCount).toBe(20);

    const quantumPlant = testGameData.buildings.find(b => b.id === '2314');
    const fullereneSilverRecipe = testGameData.recipeMap.get('90003')!;
    const fullereneSilverIo = calculateDisplayIoRates(
      fullereneSilverRecipe,
      result.recipes.get('90003')!,
      quantumPlant,
      { level: 0, mode: 'none' }
    );

    expect(fullereneSilverIo.inputs.find(rate => rate.itemId === '12001')?.actualRate).toBeCloseTo(40, 6);
    expect(fullereneSilverIo.outputs.find(rate => rate.itemId === '11005')?.actualRate).toBeCloseTo(80, 6);
    expect(fullereneSilverIo.outputs.find(rate => rate.itemId === '11005')?.multiplier).toBeCloseTo(2, 6);
  });
});
