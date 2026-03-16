import { loadGameDataFromFile } from '../src/data/loader';

test('TestConfig custom recipes use TimeSpend ticks and load as 1 second cycles', async () => {
  const gameData = await loadGameDataFromFile('./data/TestConfig.json');
  expect(gameData.recipeMap.get('90003')?.time).toBeCloseTo(1, 6);
  expect(gameData.recipeMap.get('90004')?.time).toBeCloseTo(1, 6);
});
