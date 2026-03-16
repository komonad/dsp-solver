import { loadGameDataFromFile } from '../src/data/loader';
import type { GameData } from '../src/types';

export async function loadWebTestConfig(): Promise<GameData> {
  return loadGameDataFromFile('./dist-web/TestConfig.json');
}

