import vanillaAtlas from './iconAtlas/vanillaAtlas.json';

export interface IconSpriteDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
  total_width: number;
  total_height: number;
}

const VANILLA_ATLAS_SRC = './icons/Vanilla.png';
const atlas = vanillaAtlas as Record<string, IconSpriteDefinition>;

export function getIconSprite(iconKey: string | undefined): IconSpriteDefinition | undefined {
  if (!iconKey) {
    return undefined;
  }

  return atlas[iconKey];
}

export function getIconAtlasSrc(iconKey: string | undefined): string | undefined {
  return getIconSprite(iconKey) ? VANILLA_ATLAS_SRC : undefined;
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
