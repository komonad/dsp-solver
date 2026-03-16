import { loadWebTestConfig } from './test-config-loader';
import { inferImplicitRawItems } from '../src/core/rawInference';

test('implicit raw inference only marks items with no producers', async () => {
  const gameData = await loadWebTestConfig();
  const inferred = inferImplicitRawItems(gameData);
  expect(inferred).toContain('1007');
  expect(inferred).toContain('10001');
  expect(inferred).toContain('10002');
  expect(inferred).toContain('12001');
  expect(inferred).not.toContain('10003');
  expect(inferred).not.toContain('11005');
});
