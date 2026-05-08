import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Divider, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { SolveObjective } from '../../../solver';
import { type DatasetPresetId, getDatasetPresetText } from '../../../i18n';
import type { WorkbenchProliferatorPolicy } from '../../workbench/requestBuilder';
import { DATASET_PRESETS } from '../../catalog/catalogClient';
import DatasetEditorPanel from '../../catalog/editor/DatasetEditorPanel';
import StructuredDatasetEditor from '../../catalog/editor/StructuredDatasetEditor';
import { EntityIcon } from '../../shared/EntityIcon';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import CopySolveRequestJsonButton from './CopySolveRequestJsonButton';
import RecipeConstraintSnapshotList from './RecipeConstraintSnapshotList';
import RecipePreferenceSnapshotList from './RecipePreferenceSnapshotList';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import SolveSnapshotRecipeFlowSummary from './SolveSnapshotRecipeFlowSummary';
import SolveSnapshotSummaryChips from './SolveSnapshotSummaryChips';
import { isPowerItem, pickDefaultGlobalProliferatorLevel } from '../workbenchHelpers';
import {
  cardStyle,
  compactSelectFieldSx,
  snapshotEntryActionSegmentSx,
  snapshotEntryCapsuleSx,
  snapshotEntryGroupSx,
  snapshotSelectFieldSx,
  snapshotTargetEntrySx,
  snapshotTargetFieldSx,
  snapshotTargetInputSx,
} from '../workbenchStyles';
import { useWorkbench } from '../WorkbenchContext';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import {
  buildGlobalProliferatorPreferenceDisplayEntry,
  buildRecipeProliferatorPreferenceDisplayEntries,
  getBrowserStorage,
} from '../workbenchHelpers';
import {
  getSnapshotSectionDescription,
  type SnapshotSectionId,
} from './solveSnapshotMetadata';
import {
  readWorkbenchSnapshotSectionState,
  writeWorkbenchSnapshotSectionState,
} from '../../workbench/persistence';
import {
  DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE,
  resolveWorkbenchSnapshotSectionState,
} from '../../workbench/snapshotSections';
import { buildSolveActivityViewModel } from '../../workbench/solveActivity';
import { ClickableItemLabel } from '../components/ClickableItemLabel';
import AllowedRecipeInlineEditor from './editors/AllowedRecipeInlineEditor';
import DisabledBuildingInlineEditor from './editors/DisabledBuildingInlineEditor';
import DisabledRecipeInlineEditor from './editors/DisabledRecipeInlineEditor';
import PreferredBuildingInlineEditor from './editors/PreferredBuildingInlineEditor';
import ProliferatorPreferenceInlineEditor from './editors/ProliferatorPreferenceInlineEditor';
import RawInputInlineEditor from './editors/RawInputInlineEditor';
import TargetInlineEditor from './editors/TargetInlineEditor';

export default function SolveSnapshotPanel() {
  const {
    bundle,
    locale,
    catalog,
    iconAtlasIds,
    globalProliferatorLevelOptions,
  } = useCatalog();
  const {
    model,
    autoSolveState,
    requestSummary,
    solveError,
    canStartSolve,
    canCancelSolve,
    solveCancelledForCurrentInputs,
    startSolve,
    cancelSolve,
  } = useSolve();
  const {
    targets,
    objective,
    proliferatorPolicy,
    globalProliferatorLevel,
    globalProliferatorLevelDisabled,
    setObjective,
    setProliferatorPolicy,
    setGlobalProliferatorLevel,
    hasTargets,
    recipePreferences,
    preferredBuildings,
    updateTarget,
    removeTarget,
    removeAllowedRecipeForItem,
    removeDisabledRecipe,
    removeDisabledBuilding,
    removeRecipePreference,
    removePreferredBuilding,
    unmarkItemAsRawInput,
    loadedSource,
    presetId,
    isCustomPreset,
    isLoading,
    datasetPath,
    defaultConfigPath,
    datasetEditorText,
    defaultConfigEditorText,
    datasetEditorError,
    onPresetChange,
    reloadCatalog,
    loadCatalog,
    clearCachedWorkbenchState,
    setDatasetEditorText,
    setDefaultConfigEditorText,
    applyDatasetEditorChanges,
    resetDatasetEditorToLoadedSource,
    updateDatasetEditorTexts,
    setPresetId,
    setCatalogLabel,
    setDatasetPath,
    setDefaultConfigPath,
    catalogLabel,
    labStackLayers,
    setLabStackLayers,
    beltSpeedItemsPerMin,
    setBeltSpeedItemsPerMin,
  } = useWorkbench();

  const browserStorage = useMemo(() => getBrowserStorage(), []);
  const sectionDescriptions = useMemo(() => getSnapshotSectionDescription(bundle), [bundle]);
  const [sectionState, setSectionState] = useState(DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE);
  const [addingSectionId, setAddingSectionId] = useState<string | null>(null);

  function toggleAddingSection(sectionId: string) {
    setAddingSectionId(current => (current === sectionId ? null : sectionId));
  }

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
  const solveActivity = useMemo(
    () =>
      buildSolveActivityViewModel({
        bundle,
        locale,
        solveState: autoSolveState,
        nowEpochMs: Date.now(),
      }),
    [autoSolveState, bundle, locale]
  );
  const emptySnapshotMessage = useMemo(() => {
    if (!catalog) {
      return bundle.summary.loadDatasetToStart;
    }

    if (autoSolveState.activity.status === 'cancelled') {
      return bundle.solveRequest.autoSolveCancelledHint;
    }

    if (autoSolveState.activity.status === 'running') {
      return solveActivity?.description ?? bundle.solveRequest.autoSolveRunningHint;
    }

    if (targets.length > 0) {
      return bundle.ready.description;
    }

    return bundle.summary.loadDatasetToStart;
  }, [autoSolveState.activity.status, bundle, catalog, solveActivity, targets.length]);

  const solveActionLabel =
    autoSolveState.activity.status === 'running' || solveCancelledForCurrentInputs
      ? bundle.solveRequest.restartSolveButton
      : bundle.solveRequest.startSolveButton;

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 12 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="h6" sx={{ fontSize: 16 }}>{bundle.summary.solveSnapshotTitle}</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="outlined" size="small" onClick={startSolve} disabled={!canStartSolve} sx={{ minHeight: 30, px: 1.25, fontSize: 12 }}>
            {solveActionLabel}
          </Button>
          {canCancelSolve ? (
            <Button variant="contained" size="small" color="warning" onClick={cancelSolve} sx={{ minHeight: 30, px: 1.25, fontSize: 12 }}>
              {bundle.solveRequest.cancelSolveButton}
            </Button>
          ) : null}
          <CopySolveRequestJsonButton />
        </Box>
      </Box>

      {/* Objective / Spray / Level selects */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        <TextField
          select
          size="small"
          sx={{ ...snapshotSelectFieldSx, minWidth: 100 }}
          label={bundle.summary.objectiveLabel}
          value={objective}
          onChange={event => setObjective(event.target.value as SolveObjective)}
        >
          <MenuItem value="min_buildings">{bundle.solveRequest.objectiveOptions.min_buildings}</MenuItem>
          <MenuItem value="min_power">{bundle.solveRequest.objectiveOptions.min_power}</MenuItem>
          <MenuItem value="min_external_input">{bundle.solveRequest.objectiveOptions.min_external_input}</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          sx={{ ...snapshotSelectFieldSx, minWidth: 100 }}
          label={bundle.summary.sprayLabel}
          value={proliferatorPolicy}
          onChange={event => {
            const nextPolicy = event.target.value as WorkbenchProliferatorPolicy;
            setProliferatorPolicy(nextPolicy);
            setGlobalProliferatorLevel(current =>
              nextPolicy === 'none'
                ? ''
                : typeof current === 'number' && current > 0
                  ? current
                  : nextPolicy === 'auto'
                    ? ''
                    : pickDefaultGlobalProliferatorLevel(catalog)
            );
          }}
        >
          <MenuItem value="auto">{bundle.solveRequest.proliferatorPolicyOptions.auto}</MenuItem>
          <MenuItem value="none">{bundle.solveRequest.proliferatorPolicyOptions.none}</MenuItem>
          <MenuItem value="speed">{bundle.solveRequest.proliferatorPolicyOptions.speed}</MenuItem>
          <MenuItem value="productivity">{bundle.solveRequest.proliferatorPolicyOptions.productivity}</MenuItem>
        </TextField>
        {!globalProliferatorLevelDisabled ? (
          <TextField
            select
            size="small"
            sx={{ ...snapshotSelectFieldSx, minWidth: 80 }}
            label={bundle.solveRequest.preferredSprayLevelLabel}
            value={globalProliferatorLevel === '' ? '' : String(globalProliferatorLevel)}
            onChange={event =>
              setGlobalProliferatorLevel(event.target.value ? Number(event.target.value) : '')
            }
          >
            <MenuItem value="">{bundle.common.auto}</MenuItem>
            {globalProliferatorLevelOptions.map(level => (
              <MenuItem key={level} value={String(level)}>
                {`${bundle.solveRequest.levelPrefix} ${level}`}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
      </Box>
      {solveError && hasTargets ? <Alert severity="error">{solveError}</Alert> : null}
      {requestSummary ? (
        <>
          <SolveSnapshotSummaryChips
            bundle={bundle}
            locale={locale}
            balancePolicy={requestSummary.balancePolicy}
            status={model?.status ?? null}
            activityLabel={solveActivity?.stageLabel}
          />

          <Divider />

          <CollapsibleSnapshotSection
            title={bundle.summary.targetsLabel}
            count={requestSummary.targets.length}
            description={sectionDescriptions.targets}
            expanded={sectionState.targets}
            onExpandedChange={expanded => setSectionExpanded('targets', expanded)}
            onAdd={() => toggleAddingSection('targets')}
            addLabel={bundle.solveRequest.addTargetTitle}
            adding={addingSectionId === 'targets'}
          >
            {addingSectionId === 'targets' ? (
              <TargetInlineEditor />
            ) : null}
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
                      aria-label={`${bundle.overview.requestLabel} (${isPowerItem(target.itemId, catalog?.powerItemId) ? 'MW' : '\u6bcf\u5206\u949f'})`}
                      sx={snapshotTargetInputSx}
                      value={targets[index]?.ratePerMin ?? target.ratePerMin}
                      onChange={event =>
                        updateTarget(index, {
                          ratePerMin: Number(event.currentTarget.value) || 0,
                        })
                      }
                    />
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        flex: '0 0 auto',
                        minWidth: 0,
                        pr: 0.625,
                        color: 'rgba(24, 51, 89, 0.72)',
                        fontSize: 11,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isPowerItem(target.itemId, catalog?.powerItemId) ? 'MW' : '/\u5206'}
                    </Typography>
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

          <CollapsibleSnapshotSection
            title={bundle.summary.rawInputsLabel}
            count={requestSummary.resolvedRawInputs.length}
            description={sectionDescriptions.rawInputs}
            expanded={sectionState.rawInputs}
            onExpandedChange={expanded => setSectionExpanded('rawInputs', expanded)}
            onAdd={() => toggleAddingSection('rawInputs')}
            addLabel={bundle.solveRequest.markAsRaw}
            adding={addingSectionId === 'rawInputs'}
          >
            {addingSectionId === 'rawInputs' ? (
              <RawInputInlineEditor />
            ) : null}
            {requestSummary.resolvedRawInputs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {bundle.common.none}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'flex-start' }}>
                {requestSummary.resolvedRawInputs.map(entry => (
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
                        onClick={() => unmarkItemAsRawInput(entry.itemId)}
                        disabled={!catalog}
                        variant="embedded"
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </CollapsibleSnapshotSection>

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
                placeholder="15"
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

          <Divider />
          <CollapsibleSnapshotSection
            title={bundle.summary.datasetLabel}
            description={sectionDescriptions.dataset}
            expanded={sectionState.dataset}
            onExpandedChange={expanded => setSectionExpanded('dataset', expanded)}
          >
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  sx={compactSelectFieldSx}
                  value={presetId}
                  onChange={event => onPresetChange(event.target.value as DatasetPresetId)}
                  inputProps={{ 'aria-label': bundle.summary.datasetLabel }}
                >
                  {DATASET_PRESETS.map(preset => (
                    <MenuItem key={preset.id} value={preset.id}>
                      {getDatasetPresetText(preset.id, locale).label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void loadCatalog(datasetPath, defaultConfigPath, catalogLabel, presetId)}
                  disabled={isLoading}
                  sx={{ minHeight: 36, px: 1.25 }}
                >
                  {isLoading ? bundle.datasetSource.loadingButton : bundle.datasetSource.loadButton}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={reloadCatalog}
                  disabled={isLoading}
                  sx={{ minHeight: 36, px: 1.25 }}
                >
                  {bundle.datasetSource.reloadButton}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={clearCachedWorkbenchState}
                  sx={{ minHeight: 36, px: 1.25 }}
                >
                  {bundle.datasetSource.clearCacheButton}
                </Button>
              </Stack>
            </Box>

            {isCustomPreset ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1,
                  mt: 1,
                  gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                <TextField
                  fullWidth
                  size="small"
                  label={bundle.summary.datasetPathLabel}
                  value={datasetPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel(getDatasetPresetText('custom', locale).label);
                    setDatasetPath(event.target.value);
                  }}
                  placeholder={bundle.datasetSource.datasetPathPlaceholder}
                />
                <TextField
                  fullWidth
                  size="small"
                  label={bundle.summary.defaultsPathLabel}
                  value={defaultConfigPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel(getDatasetPresetText('custom', locale).label);
                    setDefaultConfigPath(event.target.value);
                  }}
                  placeholder={bundle.datasetSource.defaultsPathPlaceholder}
                />
              </Box>
            ) : (
              <Stack spacing={0.35} sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {bundle.summary.datasetPathLabel}: {datasetPath || bundle.common.notSet}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {bundle.summary.defaultsPathLabel}: {defaultConfigPath || bundle.common.none}
                </Typography>
              </Stack>
            )}

            <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} sx={{ mt: 0.5 }}>
              {model ? (
                <>
                  <Chip
                    size="small"
                    label={`${bundle.summary.datasetLabel} ${
                      model.catalogSummary.datasetLabel ?? bundle.common.custom
                    }`}
                  />
                  <Chip size="small" label={`${bundle.summary.itemsLabel} ${model.catalogSummary.itemCount}`} />
                  <Chip size="small" label={`${bundle.summary.recipesLabel} ${model.catalogSummary.recipeCount}`} />
                  <Chip size="small" label={`${bundle.summary.buildingsLabel} ${model.catalogSummary.buildingCount}`} />
                </>
              ) : (
                <Chip size="small" label={bundle.summary.loadDatasetToStart} />
              )}
            </Stack>

            <DatasetEditorPanel
              title={bundle.datasetSource.editorTitle}
              helpText={bundle.datasetSource.editorHelp}
              datasetLabel={bundle.datasetSource.editorDatasetLabel}
              defaultsLabel={bundle.datasetSource.editorDefaultsLabel}
              datasetText={datasetEditorText}
              defaultConfigText={defaultConfigEditorText}
              applyButtonLabel={bundle.datasetSource.editorApplyButton}
              resetButtonLabel={bundle.datasetSource.editorResetButton}
              errorText={datasetEditorError}
              onDatasetTextChange={setDatasetEditorText}
              onDefaultConfigTextChange={setDefaultConfigEditorText}
              onApply={applyDatasetEditorChanges}
              onReset={resetDatasetEditorToLoadedSource}
            >
              <StructuredDatasetEditor
                title={bundle.datasetSource.structuredEditorTitle}
                helpText={bundle.datasetSource.structuredEditorHelp}
                unavailableText={bundle.datasetSource.structuredEditorUnavailable}
                tabs={{
                  items: bundle.datasetSource.structuredEditorTabs.items,
                  recipes: bundle.datasetSource.structuredEditorTabs.recipes,
                  buildingRules: bundle.datasetSource.structuredEditorTabs.buildingRules,
                  defaults: bundle.datasetSource.structuredEditorTabs.defaults,
                }}
                actions={{
                  add: bundle.datasetSource.structuredEditorAddButton,
                  remove: bundle.datasetSource.structuredEditorRemoveButton,
                }}
                datasetText={datasetEditorText}
                defaultConfigText={defaultConfigEditorText}
                onSourceTextsChange={updateDatasetEditorTexts}
              />
            </DatasetEditorPanel>
          </CollapsibleSnapshotSection>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {emptySnapshotMessage}
        </Typography>
      )}
    </article>
  );
}
