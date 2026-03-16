import { loadGameDataFromFile } from '../src/data/loader';

test('vanilla does not contain stale test item ids', async () => {
  const gameData = await loadGameDataFromFile('./data/Vanilla.json');
  expect(gameData.itemMap.has('11005')).toBe(false);
  expect(gameData.itemMap.has('fullerene-silver')).toBe(false);
  expect(gameData.itemMap.has('6006')).toBe(true);
});
