import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Divider, Tooltip, Typography } from '@mui/material';
import { EntityIcon } from '../shared/EntityIcon';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import RecipeConstraintSnapshotList from './RecipeConstraintSnapshotList';
import RecipePreferenceSnapshotList from './RecipePreferenceSnapshotList';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import SolveSnapshotRecipeFlowSummary from './SolveSnapshotRecipeFlowSummary';
import SolveSnapshotSummaryChips from './SolveSnapshotSummaryChips';
import {
  cardStyle,
  snapshotEntryActionSegmentSx,
  snapshotEntryCapsuleSx,
  snapshotEntryGroupSx,
  snapshotTargetEntrySx,
  snapshotTargetFieldSx,
  snapshotTargetInputSx,
} from './workbenchStyles';
import { useWorkbench } from './WorkbenchContext';
import {
  buildGlobalProliferatorPreferenceDisplayEntry,
  buildRecipeProliferatorPreferenceDisplayEntries,
  getBrowserStorage,
} from './workbenchHelpers';
import {
  SNAPSHOT_SECTION_DESCRIPTION,
  type SnapshotSectionId,
} from './solveSnapshotMetadata';
import {
  readWorkbenchSnapshotSectionState,
  writeWorkbenchSnapshotSectionState,
} from '../workbench/persistence';
import {
  DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE,
  resolveWorkbenchSnapshotSectionState,
} from '../workbench/snapshotSections';
import { ClickableItemLabel } from './ClickableItemLabel';

const PROLIFERATOR_PREFERENCE_TITLE = '增产偏好';
const NO_PROLIFERATOR_PREFERENCE_TEXT = '当前没有增产偏好。';

export default function SolveSnapshotPanel() {
  const {
    bundle,
    locale,
    catalog,
    loadedSource,
    iconAtlasIds,
    model,
    targets,
    objective,
    balancePolicy,
    proliferatorPolicy,
    globalProliferatorLevel,
    setProliferatorPolicy,
    setGlobalProliferatorLevel,
    hasTargets,
    requestSummary,
    solveError,
    recipePreferences,
    preferredBuildings,
    updateTarget,
    removeTarget,
    removeAllowedRecipeForItem,
    removeDisabledRecipe,
    removeDisabledBuilding,
    removeRecipePreference,
    removePreferredBuilding,
  } = useWorkbench();

  const browserStorage = useMemo(() => getBrowserStorage(), []);
  const [sectionState, setSectionState] = useState(DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE);

  useEffect(() => {
    if (!loadedSource) {
      setSectionState(DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE);
      return;
    }

    setSectionState(
      resolveWorkbenchSnapshotSectionState(
        readWorkbenchSnapshotSectionState(browserStorage, loadedSource)
      )
    );
  }, [browserStorage, loadedSource]);

  const setSectionExpanded = useCallback(
    (sectionId: SnapshotSectionId, expanded: boolean) => {
      setSectionState(current => {
        const nextState = { ...current, [sectionId]: expanded };
        if (browserStorage && loadedSource) {
          writeWorkbenchSnapshotSectionState(browserStorage, loadedSource, nextState);
        }
        return nextState;
      });
    },
    [browserStorage, loadedSource]
  );

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

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 12 }}>
      <Typography variant="h6">{bundle.summary.solveSnapshotTitle}</Typography>
      {solveError && hasTargets ? <Alert severity="error">{solveError}</Alert> : null}
      {requestSummary ? (
        <>
          <SolveSnapshotSummaryChips
            bundle={bundle}
            locale={locale}
            requestSummary={requestSummary}
            objective={objective}
            balancePolicy={balancePolicy}
            sprayLabel={requestSummary.proliferatorPolicyLabel ?? bundle.common.notSet}
            status={model?.status ?? null}
          />

          <Divider />

          <CollapsibleSnapshotSection
            title={bundle.summary.targetsLabel}
            count={requestSummary.targets.length}
            description={SNAPSHOT_SECTION_DESCRIPTION.targets}
            expanded={sectionState.targets}
            onExpandedChange={expanded => setSectionExpanded('targets', expanded)}
          >
            {requestSummary.targets.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {bundle.common.none}
              </Typography>
            ) : (
              requestSummary.targets.map((target, index) => (
                <Box key={`${target.itemId}:${index}`} sx={snapshotTargetEntrySx}>
                  <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
                    <ClickableItemLabel
                      itemId={target.itemId}
                      itemName={target.itemName}
                      iconKey={target.iconKey}
                      iconOnly
                      iconSize={22}
                      atlasIds={iconAtlasIds}
                    />
                  </Box>
                  <Box component="span" sx={snapshotTargetFieldSx}>
                    <Box
                      component="input"
                      type="text"
                      inputMode="decimal"
                      aria-label={bundle.overview.requestLabel}
                      sx={snapshotTargetInputSx}
                      value={targets[index]?.ratePerMin ?? target.ratePerMin}
                      onChange={event =>
                        updateTarget(index, {
                          ratePerMin: Number(event.currentTarget.value) || 0,
                        })
                      }
                    />
                  </Box>
                  <Box component="span" sx={snapshotEntryActionSegmentSx}>
                    <SnapshotRemoveButton
                      tooltip={bundle.solveRequest.removeTarget}
                      onClick={() => removeTarget(index)}
                      disabled={!catalog}
                      variant="embedded"
                    />
                  </Box>
                </Box>
              ))
            )}
          </CollapsibleSnapshotSection>

          <RecipeConstraintSnapshotList
            title={bundle.summary.forcedRecipesLabel}
            description={SNAPSHOT_SECTION_DESCRIPTION.allowedRecipes}
            emptyText={bundle.common.none}
            clearTooltip={bundle.summary.clearForcedRecipeButton}
            noneText={bundle.common.none}
            locale={locale}
            atlasIds={iconAtlasIds}
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
          />

          <RecipeConstraintSnapshotList
            title={bundle.summary.disabledRecipesLabel}
            description={SNAPSHOT_SECTION_DESCRIPTION.disabledRecipes}
            emptyText={bundle.common.none}
            clearTooltip={bundle.common.removeSuffix}
            noneText={bundle.common.none}
            locale={locale}
            atlasIds={iconAtlasIds}
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
          />

          <RecipePreferenceSnapshotList
            title={PROLIFERATOR_PREFERENCE_TITLE}
            description={SNAPSHOT_SECTION_DESCRIPTION.proliferatorPreferences}
            emptyText={NO_PROLIFERATOR_PREFERENCE_TEXT}
            clearTooltip={bundle.common.removeSuffix}
            atlasIds={iconAtlasIds}
            entries={displayedProliferatorEntries}
            expanded={sectionState.proliferatorPreferences}
            onExpandedChange={expanded => setSectionExpanded('proliferatorPreferences', expanded)}
          />

          <CollapsibleSnapshotSection
            title={bundle.solveRequest.disabledBuildingsLabel}
            count={requestSummary.disabledBuildings.length}
            description={SNAPSHOT_SECTION_DESCRIPTION.disabledBuildings}
            expanded={sectionState.disabledBuildings}
            onExpandedChange={expanded => setSectionExpanded('disabledBuildings', expanded)}
          >
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
            description={SNAPSHOT_SECTION_DESCRIPTION.preferredBuildings}
            expanded={sectionState.preferredBuildings}
            onExpandedChange={expanded => setSectionExpanded('preferredBuildings', expanded)}
          >
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
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {bundle.summary.loadDatasetToStart}
        </Typography>
      )}
    </article>
  );
}
