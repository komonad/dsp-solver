import type { EditableRecipePreference, EditableRecipeStrategyOverride } from './requestBuilder';
import type { WorkbenchPersistedConfig } from './persistence';

export function upsertRecipePreferenceEntry(
  currentPreferences: EditableRecipePreference[],
  recipeId: string,
  patch: Partial<EditableRecipePreference>
): EditableRecipePreference[] {
  const currentPreference =
    currentPreferences.find(preference => preference.recipeId === recipeId) ?? {
      recipeId,
      preferredBuildingId: '',
      preferredProliferatorMode: '',
      preferredProliferatorLevel: '',
    };

  const nextPreference: EditableRecipePreference = {
    ...currentPreference,
    ...patch,
    recipeId,
  };

  if (nextPreference.preferredProliferatorMode === '') {
    nextPreference.preferredProliferatorLevel = '';
  } else if (nextPreference.preferredProliferatorMode === 'none') {
    nextPreference.preferredProliferatorLevel = 0;
  } else if (nextPreference.preferredProliferatorLevel === 0) {
    nextPreference.preferredProliferatorLevel = '';
  }

  const remainingPreferences = currentPreferences.filter(
    preference => preference.recipeId !== recipeId
  );
  const hasValue = Boolean(
    nextPreference.preferredBuildingId ||
    nextPreference.preferredProliferatorMode ||
    nextPreference.preferredProliferatorLevel !== ''
  );

  return hasValue
    ? [...remainingPreferences, nextPreference]
    : remainingPreferences;
}

export function patchRecipeStrategyOverrideEntry(
  currentOverrides: EditableRecipeStrategyOverride[],
  recipeId: string,
  patch: Partial<EditableRecipeStrategyOverride>
): EditableRecipeStrategyOverride[] {
  const currentOverride =
    currentOverrides.find(override => override.recipeId === recipeId) ?? {
      recipeId,
      forcedBuildingId: '',
      forcedProliferatorMode: '',
      forcedProliferatorLevel: '',
    };

  const nextOverride: EditableRecipeStrategyOverride = {
    ...currentOverride,
    ...patch,
    recipeId,
  };

  if (nextOverride.forcedProliferatorMode === '') {
    nextOverride.forcedProliferatorLevel = '';
  } else if (nextOverride.forcedProliferatorMode === 'none') {
    nextOverride.forcedProliferatorLevel = 0;
  } else if (nextOverride.forcedProliferatorLevel === 0) {
    nextOverride.forcedProliferatorLevel = '';
  }

  const remainingOverrides = currentOverrides.filter(
    override => override.recipeId !== recipeId
  );
  const hasValue = Boolean(
    nextOverride.forcedBuildingId ||
    nextOverride.forcedProliferatorMode ||
    nextOverride.forcedProliferatorLevel !== ''
  );

  return hasValue ? [...remainingOverrides, nextOverride] : remainingOverrides;
}

export function findWorkbenchConfig(
  configs: WorkbenchPersistedConfig[],
  configId: string
): WorkbenchPersistedConfig | null {
  return configs.find(config => config.id === configId) ?? null;
}
