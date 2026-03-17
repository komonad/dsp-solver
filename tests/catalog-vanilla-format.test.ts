import { readFileSync } from 'fs';
import {
  summarizeVanillaDatasetSpec,
  type VanillaDatasetSpec,
  validateVanillaDatasetSpec,
} from '../src/catalog';

test('Vanilla.json matches inferred vanilla-compatible dataset spec', () => {
  const rawText = readFileSync('./data/Vanilla.json', 'utf8').replace(/^\uFEFF/, '');
  const raw = JSON.parse(rawText) as unknown;
  const validation = validateVanillaDatasetSpec(raw);

  expect(validation.valid).toBe(true);
  expect(validation.errors).toEqual([]);

  const summary = summarizeVanillaDatasetSpec(raw as VanillaDatasetSpec);

  expect(summary.topLevelKeys).toEqual(['items', 'recipes']);
  expect(summary.itemCount).toBe(174);
  expect(summary.recipeCount).toBe(238);
  expect(summary.itemTypes).toEqual([-1, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11]);
  expect(summary.recipeTypes).toEqual([-1, 1, 2, 3, 4, 5, 8, 15]);
  expect(summary.proliferatorCodes).toEqual([0, 1, 3, 4]);
  expect(summary.factoryIds).toEqual([
    0, 1, 2105, 2207, 2208, 2209, 2301, 2302, 2303, 2304, 2305, 2306,
    2307, 2308, 2309, 2310, 2314, 2315, 2316, 2317, 2318, 2319, 2901, 2902,
  ]);
  expect(summary.itemKeys).toEqual([
    'GridIndex',
    'ID',
    'IconName',
    'MultipleOutput',
    'Name',
    'Space',
    'Speed',
    'Type',
    'WorkEnergyPerTick',
  ]);
  expect(summary.recipeKeys).toEqual([
    'Factories',
    'ID',
    'IconName',
    'ItemCounts',
    'Items',
    'Name',
    'Proliferator',
    'ResultCounts',
    'Results',
    'TimeSpend',
    'Type',
  ]);
  expect(summary.itemKeyCounts).toMatchObject({
    GridIndex: 174,
    ID: 174,
    IconName: 174,
    MultipleOutput: 2,
    Name: 174,
    Space: 25,
    Speed: 25,
    Type: 174,
    WorkEnergyPerTick: 25,
  });
  expect(summary.recipeKeyCounts).toMatchObject({
    Factories: 238,
    ID: 238,
    IconName: 238,
    ItemCounts: 238,
    Items: 238,
    Name: 238,
    Proliferator: 238,
    ResultCounts: 238,
    Results: 238,
    TimeSpend: 238,
    Type: 238,
  });
});
