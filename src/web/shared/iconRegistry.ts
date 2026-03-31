import vanillaAtlas from '../../../data/icons/vanillaAtlas.json';
import genesisBookAtlas from '../../../data/icons/GenesisBook.json';
import moreMegaStructureAtlas from '../../../data/icons/MoreMegaStructure.json';
import orbitalRingAtlas from '../../../data/icons/OrbitalRing.json';
import { ICON_ATLAS_IMAGE_PATHS } from './webAssetPaths';

export interface IconSpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
  total_width: number;
  total_height: number;
}

export interface IconAtlasDefinition {
  src: string;
  atlas: Record<string, IconSpriteDefinition>;
}

export interface ResolvedIconSprite {
  atlasId: string;
  src: string;
  sprite: IconSpriteDefinition;
}

const ICON_ATLASES: Record<string, IconAtlasDefinition> = {
  Vanilla: {
    src: ICON_ATLAS_IMAGE_PATHS.Vanilla,
    atlas: vanillaAtlas as Record<string, IconSpriteDefinition>,
  },
  GenesisBook: {
    src: ICON_ATLAS_IMAGE_PATHS.GenesisBook,
    atlas: genesisBookAtlas as Record<string, IconSpriteDefinition>,
  },
  MoreMegaStructure: {
    src: ICON_ATLAS_IMAGE_PATHS.MoreMegaStructure,
    atlas: moreMegaStructureAtlas as Record<string, IconSpriteDefinition>,
  },
  OrbitalRing: {
    src: ICON_ATLAS_IMAGE_PATHS.OrbitalRing,
    atlas: orbitalRingAtlas as Record<string, IconSpriteDefinition>,
  },
};

function normalizeAtlasIds(atlasIds?: string[]): string[] {
  const normalized = (atlasIds ?? []).map(entry => entry.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : ['Vanilla'];
}

export function getResolvedIconSprite(
  iconKey: string | undefined,
  atlasIds?: string[]
): ResolvedIconSprite | undefined {
  if (!iconKey) {
    return undefined;
  }

  for (const atlasId of normalizeAtlasIds(atlasIds)) {
    const atlas = ICON_ATLASES[atlasId];
    const sprite = atlas?.atlas[iconKey];
    if (atlas && sprite) {
      return {
        atlasId,
        src: atlas.src,
        sprite,
      };
    }
  }

  return undefined;
}

export function getIconSprite(
  iconKey: string | undefined,
  atlasIds?: string[]
): IconSpriteDefinition | undefined {
  return getResolvedIconSprite(iconKey, atlasIds)?.sprite;
}

export function getIconAtlasSrc(iconKey: string | undefined, atlasIds?: string[]): string | undefined {
  return getResolvedIconSprite(iconKey, atlasIds)?.src;
}

export function getIconFallbackText(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return '?';
  }

  const codePoints = Array.from(trimmed);
  if (codePoints.length === 1) {
    return codePoints[0].toUpperCase();
  }

  const asciiLetters = trimmed.match(/[A-Za-z0-9]+/g);
  if (asciiLetters && asciiLetters.length > 0) {
    return asciiLetters[0].slice(0, 2).toUpperCase();
  }

  return codePoints.slice(0, 2).join('');
}

export function getIconFallbackColor(label: string): string {
  let hash = 0;
  for (const character of label) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  const hue = hash % 360;
  return `hsl(${hue} 45% 84%)`;
}

// ── Icon average color sampling ──

const loadedAtlasImages = new Map<string, HTMLImageElement>();
const loadingAtlasImages = new Map<string, Promise<HTMLImageElement | null>>();
const iconColorCache = new Map<string, string>();

function loadAtlasImage(src: string): Promise<HTMLImageElement | null> {
  const existing = loadingAtlasImages.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement | null>(resolve => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedAtlasImages.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  loadingAtlasImages.set(src, promise);
  return promise;
}

function sampleAverageColor(
  img: HTMLImageElement,
  sprite: IconSpriteDefinition
): string {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'hsl(0 0% 60%)';

  ctx.drawImage(
    img,
    sprite.x, sprite.y, sprite.width, sprite.height,
    0, 0, sprite.width, sprite.height
  );

  const imageData = ctx.getImageData(0, 0, sprite.width, sprite.height);
  const pixels = imageData.data;
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 128) continue; // skip transparent pixels
    totalR += pixels[i];
    totalG += pixels[i + 1];
    totalB += pixels[i + 2];
    count += 1;
  }

  if (count === 0) return 'hsl(0 0% 60%)';

  const r = Math.round(totalR / count);
  const g = Math.round(totalG / count);
  const b = Math.round(totalB / count);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Synchronously returns a cached icon color, or null if not yet computed.
 * Call `preloadIconColors` first to populate the cache.
 */
export function getIconColor(iconKey: string | undefined, atlasIds?: string[]): string | null {
  if (!iconKey) return null;
  const cacheKey = `${normalizeAtlasIds(atlasIds).join(',')}::${iconKey}`;
  return iconColorCache.get(cacheKey) ?? null;
}

/**
 * Preload and cache average colors for a batch of icon keys.
 * Returns a promise that resolves when all colors are available.
 */
export async function preloadIconColors(
  iconKeys: Array<{ iconKey?: string }>,
  atlasIds?: string[]
): Promise<void> {
  const normalized = normalizeAtlasIds(atlasIds);
  const toResolve: Array<{ cacheKey: string; resolved: ResolvedIconSprite }> = [];

  for (const { iconKey } of iconKeys) {
    if (!iconKey) continue;
    const cacheKey = `${normalized.join(',')}::${iconKey}`;
    if (iconColorCache.has(cacheKey)) continue;
    const resolved = getResolvedIconSprite(iconKey, normalized);
    if (resolved) {
      toResolve.push({ cacheKey, resolved });
    }
  }

  if (toResolve.length === 0) return;

  // Group by atlas src to minimize image loads
  const bySrc = new Map<string, typeof toResolve>();
  for (const entry of toResolve) {
    const group = bySrc.get(entry.resolved.src);
    if (group) {
      group.push(entry);
    } else {
      bySrc.set(entry.resolved.src, [entry]);
    }
  }

  await Promise.all(
    Array.from(bySrc.entries()).map(async ([src, entries]) => {
      const img = loadedAtlasImages.get(src) ?? (await loadAtlasImage(src));
      if (!img) return;
      for (const { cacheKey, resolved } of entries) {
        if (!iconColorCache.has(cacheKey)) {
          iconColorCache.set(cacheKey, sampleAverageColor(img, resolved.sprite));
        }
      }
    })
  );
}
