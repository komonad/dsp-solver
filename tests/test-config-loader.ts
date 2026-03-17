import { loadGameDataFromFile } from '../src/legacy/data/loader';
import type { GameData } from '../src/legacy/types';

export async function loadWebTestConfig(): Promise<GameData> {
  return loadGameDataFromFile('./dist-web/TestConfig.json');
}
