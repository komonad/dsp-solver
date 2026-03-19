import vanillaAtlas from '../iconAtlas/vanillaAtlas.json';
import genesisBookAtlas from '../iconAtlas/GenesisBook.json';
import moreMegaStructureAtlas from '../iconAtlas/MoreMegaStructure.json';

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
    src: './icons/Vanilla.png',
    atlas: vanillaAtlas as Record<string, IconSpriteDefinition>,
  },
  GenesisBook: {
    src: './icons/GenesisBook.png',
    atlas: genesisBookAtlas as Record<string, IconSpriteDefinition>,
  },
  MoreMegaStructure: {
    src: './icons/MoreMegaStructure.png',
    atlas: moreMegaStructureAtlas as Record<string, IconSpriteDefinition>,
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
