import React, { useMemo } from 'react';
import { Box, TextField, Tooltip, Typography } from '@mui/material';
import { EntityIcon } from '../../shared/EntityIcon';
import type { WorkbenchSnapshotSectionState } from '../../workbench/snapshotSections';
import { useCatalog } from '../CatalogContext';
import { useWorkbench } from '../WorkbenchContext';
import { useSolve } from '../SolveContext';
import { buildGlobalProliferatorPreferenceDisplayEntry, buildRecipeProliferatorPreferenceDisplayEntries } from '../workbenchHelpers';
import { snapshotEntryActionSegmentSx, snapshotEntryCapsuleSx, snapshotEntryGroupSx } from '../workbenchStyles';
import { getSnapshotSectionDescription, type SnapshotSectionId } from './solveSnapshotMetadata';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import RecipeConstraintSnapshotList from './RecipeConstraintSnapshotList';
import RecipePreferenceSnapshotList from './RecipePreferenceSnapshotList';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import SolveSnapshotRecipeFlowSummary from './SolveSnapshotRecipeFlowSummary';
import AllowedRecipeInlineEditor from './editors/AllowedRecipeInlineEditor';
import DisabledBuildingInlineEditor from './editors/DisabledBuildingInlineEditor';
import DisabledRecipeInlineEditor from './editors/DisabledRecipeInlineEditor';
import PreferredBuildingInlineEditor from './editors/PreferredBuildingInlineEditor';
import ProliferatorPreferenceInlineEditor from './editors/ProliferatorPreferenceInlineEditor';

interface SnapshotPreferencesProps {
  sectionState: WorkbenchSnapshotSectionState;
  setSectionExpanded: (id: SnapshotSectionId, expanded: boolean) => void;
  addingSectionId: string | null;
  toggleAddingSection: (id: string) => void;
}

export default function SnapshotPreferences({ sectionState, setSectionExpanded, addingSectionId, toggleAddingSection }: SnapshotPreferencesProps) {
  const { bundle, locale, catalog, iconAtlasIds } = useCatalog();
  const { requestSummary } = useSolve();
  const {
    recipePreferences, preferredBuildings, proliferatorPolicy, globalProliferatorLevel,
    setProliferatorPolicy, setGlobalProliferatorLevel, removeAllowedRecipeForItem,
    removeDisabledRecipe, removeDisabledBuilding, removeRecipePreference, removePreferredBuilding,
    labStackLayers, setLabStackLayers, beltSpeedItemsPerMin, setBeltSpeedItemsPerMin,
  } = useWorkbench();
  const sectionDescriptions = getSnapshotSectionDescription(bundle);
  const proliferatorPreferenceEntries = useMemo(
    () =>
      catalog
        ? buildRecipeProliferatorPreferenceDisplayEntries(catalog, recipePreferences, locale)
        : [],
    [catalog, locale, recipePreferences]
  );
  const globalProliferatorPreferenceEntry = useMemo(
    () =>
      buildGlobalProliferatorPreferenceDisplayEntry(
        proliferatorPolicy,
        globalProliferatorLevel,
        locale
      ),
    [globalProliferatorLevel, locale, proliferatorPolicy]
  );
  const displayedProliferatorEntries = useMemo(
    () => [
      ...(globalProliferatorPreferenceEntry
        ? [
            {
              recipeId: globalProliferatorPreferenceEntry.recipeId,
              recipeName: globalProliferatorPreferenceEntry.recipeName,
              recipeIconKey: globalProliferatorPreferenceEntry.recipeIconKey,
              showIcon: false,
              proliferatorPreferenceLabel:
                globalProliferatorPreferenceEntry.proliferatorPreferenceLabel,
              onRemove: () => {
                setProliferatorPolicy('auto');
                setGlobalProliferatorLevel('');
              },
            },
          ]
        : []),
      ...proliferatorPreferenceEntries.map(setting => ({
        recipeId: setting.recipeId,
        recipeName: setting.recipeName,
        recipeIconKey: setting.recipeIconKey,
        proliferatorPreferenceLabel: setting.proliferatorPreferenceLabel,
        onRemove: () => removeRecipePreference(setting.recipeId),
      })),
    ],
    [
      globalProliferatorPreferenceEntry,
      proliferatorPreferenceEntries,
      removeRecipePreference,
      setGlobalProliferatorLevel,
      setProliferatorPolicy,
    ]
  );

  if (!requestSummary) return null;
  return <>
    <RecipeConstraintSnapshotList
      title={bundle.summary.forcedRecipesLabel}
      description={sectionDescriptions.allowedRecipes}
      emptyText={bundle.common.none}
      clearTooltip={bundle.summary.clearForcedRecipeButton}
      noneText={bundle.common.none}
      locale={locale}
      atlasIds={iconAtlasIds}
      powerItemId={catalog?.powerItemId}
      entries={requestSummary.allowedRecipeSettings.map(setting => ({
        key: `${setting.itemId}:${setting.recipeId}`,
        recipeName: setting.recipeName,
        inputs: setting.inputs,
        outputs: setting.outputs,
        cycleTimeSec: setting.cycleTimeSec,
        highlightItemId: setting.itemId,
        onRemove: () => removeAllowedRecipeForItem(setting.itemId, setting.recipeId),
      }))}
      expanded={sectionState.allowedRecipes}
      onExpandedChange={expanded => setSectionExpanded('allowedRecipes', expanded)}
      onAdd={() => toggleAddingSection('allowedRecipes')}
      adding={addingSectionId === 'allowedRecipes'}
      inlineEditor={
        addingSectionId === 'allowedRecipes' ? (
          <AllowedRecipeInlineEditor />
        ) : null
      }
    />

    <RecipeConstraintSnapshotList
      title={bundle.summary.disabledRecipesLabel}
      description={sectionDescriptions.disabledRecipes}
      emptyText={bundle.common.none}
      clearTooltip={bundle.common.removeSuffix}
      noneText={bundle.common.none}
      locale={locale}
      atlasIds={iconAtlasIds}
      powerItemId={catalog?.powerItemId}
      entries={requestSummary.disabledRecipeSettings.map(setting => ({
        key: setting.recipeId,
        recipeName: setting.recipeName,
        inputs: setting.inputs,
        outputs: setting.outputs,
        cycleTimeSec: setting.cycleTimeSec,
        onRemove: () => removeDisabledRecipe(setting.recipeId),
      }))}
      expanded={sectionState.disabledRecipes}
      onExpandedChange={expanded => setSectionExpanded('disabledRecipes', expanded)}
      onAdd={() => toggleAddingSection('disabledRecipes')}
      adding={addingSectionId === 'disabledRecipes'}
      inlineEditor={
        addingSectionId === 'disabledRecipes' ? (
          <DisabledRecipeInlineEditor />
        ) : null
      }
    />

    <RecipePreferenceSnapshotList
      title={bundle.summary.proliferatorPreferencesLabel}
      description={sectionDescriptions.proliferatorPreferences}
      emptyText={bundle.summary.noProliferatorPreferences}
      clearTooltip={bundle.common.removeSuffix}
      atlasIds={iconAtlasIds}
      entries={displayedProliferatorEntries}
      expanded={sectionState.proliferatorPreferences}
      onExpandedChange={expanded => setSectionExpanded('proliferatorPreferences', expanded)}
      onAdd={() => toggleAddingSection('proliferatorPreferences')}
      adding={addingSectionId === 'proliferatorPreferences'}
      inlineEditor={
        addingSectionId === 'proliferatorPreferences' ? (
          <ProliferatorPreferenceInlineEditor />
        ) : null
      }
    />

    <CollapsibleSnapshotSection
      title={bundle.solveRequest.disabledBuildingsLabel}
      count={requestSummary.disabledBuildings.length}
      description={sectionDescriptions.disabledBuildings}
      expanded={sectionState.disabledBuildings}
      onExpandedChange={expanded => setSectionExpanded('disabledBuildings', expanded)}
      onAdd={() => toggleAddingSection('disabledBuildings')}
      adding={addingSectionId === 'disabledBuildings'}
    >
      {addingSectionId === 'disabledBuildings' ? (
        <DisabledBuildingInlineEditor />
      ) : null}
      {requestSummary.disabledBuildings.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {bundle.common.none}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'flex-start' }}>
          {requestSummary.disabledBuildings.map(entry => (
            <Box key={entry.itemId} sx={snapshotEntryGroupSx}>
              <Box sx={snapshotEntryCapsuleSx}>
                <Tooltip title={entry.itemName}>
                  <Box sx={{ display: 'inline-flex' }}>
                    <EntityIcon
                      label={entry.itemName}
                      iconKey={entry.iconKey}
                      atlasIds={iconAtlasIds}
                      size={18}
                    />
                  </Box>
                </Tooltip>
              </Box>
              <Box component="span" sx={snapshotEntryActionSegmentSx}>
                <SnapshotRemoveButton
                  tooltip={bundle.common.removeSuffix}
                  onClick={() => removeDisabledBuilding(entry.itemId)}
                  disabled={!catalog}
                  variant="embedded"
                />
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </CollapsibleSnapshotSection>

    <CollapsibleSnapshotSection
      title={bundle.summary.preferredBuildingsLabel}
      count={preferredBuildings.length}
      description={sectionDescriptions.preferredBuildings}
      expanded={sectionState.preferredBuildings}
      onExpandedChange={expanded => setSectionExpanded('preferredBuildings', expanded)}
      onAdd={() => toggleAddingSection('preferredBuildings')}
      adding={addingSectionId === 'preferredBuildings'}
    >
      {addingSectionId === 'preferredBuildings' ? (
        <PreferredBuildingInlineEditor />
      ) : null}
      {preferredBuildings.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {bundle.common.none}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'flex-start' }}>
          {preferredBuildings.map((entry, index) => {
            const building = catalog?.buildingMap.get(entry.buildingId);
            const recipe = entry.recipeId ? catalog?.recipeMap.get(entry.recipeId) : null;
            return (
              <Box
                key={`${entry.buildingId}:${entry.recipeId}:${index}`}
                sx={snapshotEntryGroupSx}
              >
                <Box sx={snapshotEntryCapsuleSx}>
                  <Box
                    sx={{
                      minWidth: 0,
                      maxWidth: '100%',
                      flex: '1 1 auto',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 0.375,
                      minHeight: 0,
                    }}
                  >
                    <EntityIcon
                      label={building?.name ?? entry.buildingId}
                      iconKey={building?.icon}
                      atlasIds={iconAtlasIds}
                      size={18}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600, flexShrink: 0 }}>
                      :
                    </Typography>
                    {recipe ? (
                      <Tooltip title={recipe.name}>
                        <Box sx={{ minWidth: 0, display: 'flex', maxWidth: '100%' }}>
                          <SolveSnapshotRecipeFlowSummary
                            recipe={recipe}
                            locale={locale}
                            atlasIds={iconAtlasIds}
                            noneText={bundle.common.none}
                            catalog={catalog}
                          />
                        </Box>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        *
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box component="span" sx={snapshotEntryActionSegmentSx}>
                  <SnapshotRemoveButton
                    tooltip={bundle.summary.removePreferredBuildingButton}
                    onClick={() => removePreferredBuilding(index)}
                    disabled={!catalog}
                    variant="embedded"
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </CollapsibleSnapshotSection>

    <CollapsibleSnapshotSection
      title={bundle.solveRequest.buildingParametersLabel}
      description={sectionDescriptions.buildingParameters}
      expanded={sectionState.buildingParameters}
      onExpandedChange={expanded => setSectionExpanded('buildingParameters', expanded)}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          type="number"
          label={bundle.solveRequest.labStackLayersLabel}
          value={labStackLayers ?? ''}
          placeholder={String(catalog?.recommendedSolve.defaultStackLayers ?? 15)}
          onChange={event => {
            const val = event.target.value;
            if (!val) {
              setLabStackLayers(undefined);
            } else {
              const num = Math.max(1, Math.round(Number(val)));
              setLabStackLayers(Number.isFinite(num) ? num : undefined);
            }
          }}
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          type="number"
          label={bundle.solveRequest.beltSpeedLabel}
          value={beltSpeedItemsPerMin ?? ''}
          onChange={event => {
            const val = event.target.value;
            if (!val) {
              setBeltSpeedItemsPerMin(undefined);
            } else {
              const num = Number(val);
              setBeltSpeedItemsPerMin(Number.isFinite(num) && num > 0 ? num : undefined);
            }
          }}
          slotProps={{ htmlInput: { min: 1 } }}
          sx={{ width: 180 }}
        />
      </Box>
    </CollapsibleSnapshotSection>
  </>;
}
