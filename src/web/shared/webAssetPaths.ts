function normalizeBundledAssetPath(relativePath: string): string {
  return `./${relativePath.replace(/^\.?\//, '')}`;
}

export const BUNDLED_DATASET_PATHS = {
  vanilla: {
    datasetPath: normalizeBundledAssetPath('Vanilla.json'),
    defaultConfigPath: normalizeBundledAssetPath('Vanilla.defaults.json'),
  },
  vanillaMkIV: {
    datasetPath: normalizeBundledAssetPath('VanillaMkIV.json'),
    defaultConfigPath: normalizeBundledAssetPath('VanillaMkIV.defaults.json'),
  },
  orbitalRing: {
    datasetPath: normalizeBundledAssetPath('OrbitalRing.json'),
    defaultConfigPath: normalizeBundledAssetPath('OrbitalRing.defaults.json'),
  },
} as const;

export const ICON_ATLAS_IMAGE_PATHS = {
  Vanilla: normalizeBundledAssetPath('icons/Vanilla.png'),
  GenesisBook: normalizeBundledAssetPath('icons/GenesisBook.png'),
  MoreMegaStructure: normalizeBundledAssetPath('icons/MoreMegaStructure.png'),
  OrbitalRing: normalizeBundledAssetPath('icons/OrbitalRing.png'),
  ProliferatorMk4: normalizeBundledAssetPath('icons/ProliferatorMk4.png'),
} as const;
