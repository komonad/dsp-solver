import { buildRecipePlanRevealKey } from '../src/web/shared/recipePlanReveal';

test('buildRecipePlanRevealKey matches recipe plan cards and item slice plan references', () => {
  expect(
    buildRecipePlanRevealKey({
      recipeId: '115',
      buildingId: '2314',
      proliferatorLabel: '加速 等级 3',
    })
  ).toBe('115:2314:加速 等级 3');
});
