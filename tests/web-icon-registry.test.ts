import {
  getIconAtlasSrc,
  getIconFallbackText,
  getResolvedIconSprite,
  getIconSprite,
} from '../src/web/shared/iconRegistry';

test('vanilla icon atlas resolves known icon keys', () => {
  expect(getIconSprite('iron-plate')).toEqual({
    x: expect.any(Number),
    y: expect.any(Number),
    width: 80,
    height: 80,
    total_width: 1120,
    total_height: 1120,
  });
  expect(getIconAtlasSrc('iron-plate')).toBe('./icons/Vanilla.png');
});

test('icon registry returns no sprite for unknown keys', () => {
  expect(getIconSprite('non-existent-icon')).toBeUndefined();
  expect(getIconAtlasSrc('non-existent-icon')).toBeUndefined();
});

test('icon registry respects configured atlas search order and falls back to vanilla default', () => {
  expect(getResolvedIconSprite('iron-plate', ['Vanilla'])?.atlasId).toBe('Vanilla');
  expect(getResolvedIconSprite('iron-plate', ['UnknownPack'])?.atlasId).toBeUndefined();
  expect(getResolvedIconSprite('iron-plate')?.atlasId).toBe('Vanilla');
});

test('icon registry can resolve mod atlas packs when requested', () => {
  expect(getResolvedIconSprite('Ccoal', ['MoreMegaStructure'])?.atlasId).toBe(
    'MoreMegaStructure'
  );
  expect(getIconAtlasSrc('Ccoal', ['MoreMegaStructure'])).toBe('./icons/MoreMegaStructure.png');
  expect(getResolvedIconSprite('iron-ore', ['OrbitalRing'])?.atlasId).toBe('OrbitalRing');
  expect(getIconAtlasSrc('iron-ore', ['OrbitalRing'])).toBe('./icons/OrbitalRing.png');
});

test('icon fallback text supports ascii and non-ascii labels', () => {
  expect(getIconFallbackText('Demo Ore')).toBe('DE');
  expect(getIconFallbackText('核心素')).toBe('核心');
  expect(getIconFallbackText(' x ')).toBe('X');
});
