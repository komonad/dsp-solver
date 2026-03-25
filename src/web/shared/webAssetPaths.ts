function normalizeBundledAssetPath(relativePath: string): string {
  return `./${relativePath.replace(/^\.?\//, '')}`;
}

export const BUNDLED_DATASET_PATHS = {
  vanilla: {
    datasetPath: normalizeBundledAssetPath('Vanilla.json'),
    defaultConfigPath: normalizeBundledAssetPath('Vanilla.defaults.json'),
  },
  demoSmelting: {
    datasetPath: normalizeBundledAssetPath('DemoSmelting.json'),
    defaultConfigPath: normalizeBundledAssetPath('DemoSmelting.defaults.json'),
  },
  refineryBalance: {
    datasetPath: normalizeBundledAssetPath('RefineryBalance.json'),
    defaultConfigPath: normalizeBundledAssetPath('RefineryBalance.defaults.json'),
  },
  fullereneLoop: {
    datasetPath: normalizeBundledAssetPath('FullereneLoop.json'),
    defaultConfigPath: normalizeBundledAssetPath('FullereneLoop.defaults.json'),
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
} as const;

