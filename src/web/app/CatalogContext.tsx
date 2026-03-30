import React, { createContext, useContext, useMemo } from 'react';
import type { ProliferatorMode, ResolvedCatalogModel, ResolvedRecipeSpec } from '../../catalog';
import type { AppLocale } from '../../i18n';
import { getLocaleBundle } from '../../i18n';
import type { ItemPickerOption } from '../shared/itemPickerModel';
import {
  buildRecipeOptionsByOutputItem,
  sortModeOptions,
  type WorkbenchRecipeOption,
} from './workbenchHelpers';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface CatalogContextValue {
  locale: AppLocale;
  bundle: ReturnType<typeof getLocaleBundle>;
  catalog: ResolvedCatalogModel | null;
  iconAtlasIds: string[];

  // Sorted, catalog-derived option lists (stable after catalog load)
  itemOptions: ItemPickerOption[];
  recipeOptions: ResolvedRecipeSpec[];
  buildingOptions: ResolvedCatalogModel['buildings'];
  preferredRecipeOptionsByItem: Record<string, WorkbenchRecipeOption[]>;
  globalProliferatorLevelOptions: number[];

  // Query functions
  getRecipeDefinition: (recipeId: string) => ResolvedRecipeSpec | undefined;
  getRecipeBuildingOptions: (
    recipeId: string
  ) => Array<NonNullable<ReturnType<ResolvedCatalogModel['buildingMap']['get']>>>;
  getRecipeModeOptions: (recipeId: string) => ProliferatorMode[];
  getRecipeLevelOptions: (recipeId: string) => number[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CatalogContext = createContext<CatalogContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CatalogProvider({
  locale,
  bundle,
  catalog,
  iconAtlasIds,
  children,
}: {
  locale: AppLocale;
  bundle: ReturnType<typeof getLocaleBundle>;
  catalog: ResolvedCatalogModel | null;
  iconAtlasIds: string[];
  children: React.ReactNode;
}) {
  const itemOptions = useMemo<ItemPickerOption[]>(
    () =>
      catalog?.items
        .filter(item => item.kind !== 'utility')
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(item => ({
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
        })) ?? [],
    [catalog]
  );

  const recipeOptions = useMemo(
    () =>
      catalog?.recipes.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const buildingOptions = useMemo(
    () =>
      catalog?.buildings.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const preferredRecipeOptionsByItem = useMemo(
    () => buildRecipeOptionsByOutputItem(catalog),
    [catalog]
  );

  const globalProliferatorLevelOptions = useMemo(
    () =>
      catalog
        ? catalog.proliferatorLevels
            .map(level => level.level)
            .filter(level => level > 0)
            .sort((left, right) => left - right)
        : [],
    [catalog]
  );

  const getRecipeDefinition = useMemo(
    () => (recipeId: string): ResolvedRecipeSpec | undefined =>
      catalog?.recipeMap.get(recipeId),
    [catalog]
  );

  const getRecipeBuildingOptions = useMemo(
    () => (recipeId: string) => {
      const recipe = catalog?.recipeMap.get(recipeId);
      if (!catalog || !recipe) {
        return [];
      }
      return recipe.allowedBuildingIds
        .map(buildingId => catalog.buildingMap.get(buildingId))
        .filter((building): building is NonNullable<typeof building> => Boolean(building))
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    [catalog]
  );

  const getRecipeModeOptions = useMemo(
    () => (recipeId: string): ProliferatorMode[] => {
      const recipe = catalog?.recipeMap.get(recipeId);
      if (!recipe) {
        return [];
      }
      return sortModeOptions(Array.from(new Set(recipe.supportsProliferatorModes)));
    },
    [catalog]
  );

  const getRecipeLevelOptions = useMemo(
    () => (recipeId: string): number[] => {
      const recipe = catalog?.recipeMap.get(recipeId);
      if (!catalog || !recipe || recipe.maxProliferatorLevel <= 0) {
        return [];
      }
      return catalog.proliferatorLevels
        .map(level => level.level)
        .filter(level => level > 0 && level <= recipe.maxProliferatorLevel)
        .sort((left, right) => left - right);
    },
    [catalog]
  );

  const contextValue = useMemo<CatalogContextValue>(
    () => ({
      locale,
      bundle,
      catalog,
      iconAtlasIds,
      itemOptions,
      recipeOptions,
      buildingOptions,
      preferredRecipeOptionsByItem,
      globalProliferatorLevelOptions,
      getRecipeDefinition,
      getRecipeBuildingOptions,
      getRecipeModeOptions,
      getRecipeLevelOptions,
    }),
    [
      locale,
      bundle,
      catalog,
      iconAtlasIds,
      itemOptions,
      recipeOptions,
      buildingOptions,
      preferredRecipeOptionsByItem,
      globalProliferatorLevelOptions,
      getRecipeDefinition,
      getRecipeBuildingOptions,
      getRecipeModeOptions,
      getRecipeLevelOptions,
    ]
  );

  return (
    <CatalogContext.Provider value={contextValue}>{children}</CatalogContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
