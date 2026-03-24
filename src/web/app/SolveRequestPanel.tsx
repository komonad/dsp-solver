import React from 'react';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { ProliferatorMode } from '../../catalog';
import { formatProliferatorMode } from '../../i18n';
import type { BalancePolicy, SolveObjective } from '../../solver';
import type { WorkbenchProliferatorPolicy } from '../workbench/requestBuilder';
import ItemGridPicker from '../shared/ItemGridPicker';
import { EntityLabel } from '../shared/EntityIcon';
import { SelectOption } from './SelectOption';
import { sortModeOptions, pickDefaultGlobalProliferatorLevel } from './workbenchHelpers';
import {
  cardStyle,
  collapsibleSectionStyle,
  compactSelectFieldSx,
  inputStyle,
  summaryStyle,
} from './workbenchStyles';
import { useWorkbench } from './WorkbenchContext';

// ---------------------------------------------------------------------------
// SolveRequestPanel
// ---------------------------------------------------------------------------

export default function SolveRequestPanel() {
  const {
    bundle,
    locale,
    catalog,
    model,
    iconAtlasIds,
    itemOptions,
    targetDraftItemId,
    targetDraftRatePerMin,
    targetPickerQuery,
    targetDraftItemOption,
    objective,
    balancePolicy,
    proliferatorPolicy,
    globalProliferatorLevel,
    globalProliferatorLevelOptions,
    globalProliferatorLevelDisabled,
    autoPromoteUnavailableItemsToRawInputs,
    disabledRecipeIds,
    disabledRecipeDraftId,
    disableRecipeOptions,
    disabledBuildingIds,
    disabledBuildingDraftId,
    disableBuildingOptions,
    recipePreferences,
    recipePreferenceDraftId,
    recipePreferenceOptions,
    advancedOverridesText,
    parsedOverrides,
    setTargetPickerQuery,
    setTargetDraftItemId,
    setTargetDraftRatePerMin,
    setObjective,
    setBalancePolicy,
    setProliferatorPolicy,
    setGlobalProliferatorLevel,
    setAutoPromoteUnavailableItemsToRawInputs,
    setDisabledRecipeDraftId,
    setDisabledBuildingDraftId,
    setRecipePreferenceDraftId,
    setAdvancedOverridesText,
    addTarget,
    addDisabledRecipe,
    removeDisabledRecipe,
    addDisabledBuilding,
    removeDisabledBuilding,
    addRecipePreference,
    updateRecipePreference,
    removeRecipePreference,
    getRecipeBuildingOptions,
    getRecipeModeOptions,
    getRecipeLevelOptions,
  } = useWorkbench();

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 14 }}>
      <Typography variant="h6">{bundle.solveRequest.title}</Typography>
      <div style={{ display: 'grid', gap: 16 }}>
        {/* Target editor section */}
        <div style={{ display: 'grid', gap: 10 }}>
          <Typography variant="body2" color="text.secondary">
            {bundle.solveRequest.editTargetsHint}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              p: 1.75,
              borderRadius: '16px',
              border: '1px dashed',
              borderColor: 'divider',
              backgroundColor: 'rgba(22, 54, 89, 0.03)',
            }}
          >
            <Typography variant="subtitle2">{bundle.solveRequest.addTargetTitle}</Typography>

            <ItemGridPicker
              items={itemOptions}
              selectedItemId={targetDraftItemId}
              query={targetPickerQuery}
              onQueryChange={setTargetPickerQuery}
              onSelect={setTargetDraftItemId}
              atlasIds={iconAtlasIds}
              searchLabel={bundle.solveRequest.targetSearchLabel}
              searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
              emptyText={bundle.solveRequest.targetPickerEmpty}
            />

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) 104px auto' },
                alignItems: 'center',
              }}
            >
              <Box
                sx={{
                  minHeight: 40,
                  px: 1.25,
                  borderRadius: '12px',
                  border: '1px solid rgba(24, 51, 89, 0.12)',
                  backgroundColor: 'rgba(255,255,255,0.86)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {targetDraftItemOption ? (
                  <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {bundle.solveRequest.selectedTargetLabel}
                    </Typography>
                    <EntityLabel
                      label={targetDraftItemOption.name}
                      iconKey={targetDraftItemOption.icon}
                      atlasIds={iconAtlasIds}
                      size={18}
                    />
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {bundle.common.notSet}
                  </Typography>
                )}
              </Box>

              <TextField
                type="number"
                fullWidth
                size="small"
                label={bundle.overview.requestLabel}
                value={targetDraftRatePerMin}
                inputProps={{ min: 0, step: 1 }}
                onChange={event =>
                  setTargetDraftRatePerMin(Number(event.target.value) || 0)
                }
              />

              <Button
                variant="contained"
                size="small"
                onClick={() =>
                  addTarget({
                    itemId: targetDraftItemId,
                    ratePerMin: targetDraftRatePerMin,
                  })
                }
                disabled={!catalog || !targetDraftItemId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.addTarget}
              </Button>
            </Box>
          </Box>
        </div>

        {/* Solve options bar */}
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(150px, 188px))' },
          }}
        >
          <TextField
            select
            size="small"
            sx={compactSelectFieldSx}
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
            sx={compactSelectFieldSx}
            label={bundle.summary.balanceLabel}
            value={balancePolicy}
            onChange={event => setBalancePolicy(event.target.value as BalancePolicy)}
          >
            <MenuItem value="force_balance">{bundle.solveRequest.balancePolicyOptions.force_balance}</MenuItem>
            <MenuItem value="allow_surplus">{bundle.solveRequest.balancePolicyOptions.allow_surplus}</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            sx={compactSelectFieldSx}
            label={bundle.summary.sprayLabel}
            value={proliferatorPolicy}
            onChange={event => {
              const nextPolicy = event.target.value as WorkbenchProliferatorPolicy;
              setProliferatorPolicy(nextPolicy);
              setGlobalProliferatorLevel(current =>
                nextPolicy === 'auto' || nextPolicy === 'none'
                  ? ''
                  : typeof current === 'number' && current > 0
                    ? current
                    : pickDefaultGlobalProliferatorLevel(catalog)
              );
            }}
          >
            <MenuItem value="auto">{bundle.solveRequest.proliferatorPolicyOptions.auto}</MenuItem>
            <MenuItem value="none">{bundle.solveRequest.proliferatorPolicyOptions.none}</MenuItem>
            <MenuItem value="speed">{bundle.solveRequest.proliferatorPolicyOptions.speed}</MenuItem>
            <MenuItem value="productivity">{bundle.solveRequest.proliferatorPolicyOptions.productivity}</MenuItem>
          </TextField>

          <TextField
            select
            size="small"
            sx={compactSelectFieldSx}
            label={bundle.solveRequest.preferredSprayLevelLabel}
            value={globalProliferatorLevel === '' ? '' : String(globalProliferatorLevel)}
            disabled={globalProliferatorLevelDisabled}
            onChange={event =>
              setGlobalProliferatorLevel(
                event.target.value ? Number(event.target.value) : ''
              )
            }
          >
            <MenuItem value="">{bundle.common.auto}</MenuItem>
            {globalProliferatorLevelOptions.map(level => (
              <MenuItem key={level} value={String(level)}>
                {`${bundle.solveRequest.levelPrefix} ${level}`}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        {/* Auto promote switch */}
        <FormControlLabel
          control={
            <Switch
              checked={autoPromoteUnavailableItemsToRawInputs}
              onChange={event =>
                setAutoPromoteUnavailableItemsToRawInputs(event.target.checked)
              }
            />
          }
          label={bundle.solveRequest.autoPromoteUnavailableItemsLabel}
        />

        {/* Disabled recipes collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.solveRequest.disabledRecipesLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                alignItems: 'start',
              }}
            >
              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.solveRequest.disabledRecipesLabel}
                value={disabledRecipeDraftId}
                onChange={event => setDisabledRecipeDraftId(event.target.value)}
                disabled={!catalog || disableRecipeOptions.length === 0}
              >
                {disableRecipeOptions.map(recipe => (
                  <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                    <SelectOption label={recipe.name} iconKey={recipe.icon} size={18} />
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={addDisabledRecipe}
                disabled={!disabledRecipeDraftId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.disableButton}
              </Button>
            </Box>

            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
              {disabledRecipeIds.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{bundle.solveRequest.noDisabledRecipes}</Typography>
              ) : (
                disabledRecipeIds.map(recipeId => (
                  <Chip
                    key={recipeId}
                    label={(catalog?.recipeMap.get(recipeId)?.name ?? recipeId) + ` ${bundle.common.removeSuffix}`}
                    onDelete={() => removeDisabledRecipe(recipeId)}
                  />
                ))
              )}
            </Stack>
          </div>
        </details>

        {/* Disabled buildings collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.solveRequest.disabledBuildingsLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                alignItems: 'start',
              }}
            >
              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.solveRequest.disabledBuildingsLabel}
                value={disabledBuildingDraftId}
                onChange={event => setDisabledBuildingDraftId(event.target.value)}
                disabled={!catalog || disableBuildingOptions.length === 0}
              >
                {disableBuildingOptions.map(building => (
                  <MenuItem key={building.buildingId} value={building.buildingId}>
                    <SelectOption label={building.name} iconKey={building.icon} size={18} />
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={addDisabledBuilding}
                disabled={!disabledBuildingDraftId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.disableButton}
              </Button>
            </Box>

            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
              {disabledBuildingIds.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{bundle.solveRequest.noDisabledBuildings}</Typography>
              ) : (
                disabledBuildingIds.map(buildingId => (
                  <Chip
                    key={buildingId}
                    label={
                      (catalog?.buildingMap.get(buildingId)?.name ?? buildingId) +
                      ` ${bundle.common.removeSuffix}`
                    }
                    onDelete={() => removeDisabledBuilding(buildingId)}
                  />
                ))
              )}
            </Stack>
          </div>
        </details>

        {/* Recipe preferences collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.solveRequest.recipePreferencesLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 240px) auto' },
                alignItems: 'start',
              }}
            >
              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.solveRequest.recipePreferencesLabel}
                value={recipePreferenceDraftId}
                onChange={event => setRecipePreferenceDraftId(event.target.value)}
                disabled={!catalog || recipePreferenceOptions.length === 0}
              >
                {recipePreferenceOptions.map(recipe => (
                  <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                    <SelectOption label={recipe.name} iconKey={recipe.icon} size={18} />
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={addRecipePreference}
                disabled={!recipePreferenceDraftId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.addPreference}
              </Button>
            </Box>

            <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13, lineHeight: 1.5 }}>
              {bundle.solveRequest.recipePreferencesHelp}
            </div>

            {recipePreferences.length === 0 ? (
              <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>{bundle.solveRequest.noRecipePreferences}</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {recipePreferences.map(preference => {
                  const recipe = catalog?.recipeMap.get(preference.recipeId);
                  const buildingChoices = getRecipeBuildingOptions(preference.recipeId);
                  const modeChoices = getRecipeModeOptions(preference.recipeId);
                  const levelChoices = getRecipeLevelOptions(preference.recipeId);
                  const levelSelectDisabled =
                    proliferatorPolicy === 'none' ||
                    levelChoices.length === 0 ||
                    preference.preferredProliferatorMode === 'none';

                  return (
                    <div
                      key={preference.recipeId}
                      style={{
                        borderRadius: 14,
                        border: '1px solid rgba(24, 51, 89, 0.12)',
                        background: 'rgba(255,255,255,0.6)',
                        padding: 12,
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 1.5,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <Typography fontWeight={700}>{recipe?.name ?? preference.recipeId}</Typography>
                        <Button
                          variant="outlined"
                          color="inherit"
                          size="small"
                          onClick={() => removeRecipePreference(preference.recipeId)}
                        >
                          {bundle.solveRequest.removeTarget}
                        </Button>
                      </Box>

                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1,
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        }}
                      >
                        <Box sx={{ display: 'grid', gap: 0.75 }}>
                          <Typography variant="overline" color="text.secondary">
                            {bundle.solveRequest.preferredBuildingLabel}
                          </Typography>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            sx={compactSelectFieldSx}
                            value={preference.preferredBuildingId}
                            onChange={event =>
                              updateRecipePreference(preference.recipeId, {
                                preferredBuildingId: event.target.value,
                              })
                            }
                          >
                            <MenuItem value="">{bundle.common.auto}</MenuItem>
                            {buildingChoices.map(building => (
                              <MenuItem key={building.buildingId} value={building.buildingId}>
                                <SelectOption label={building.name} iconKey={building.icon} size={18} />
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>

                        <Box sx={{ display: 'grid', gap: 0.75 }}>
                          <Typography variant="overline" color="text.secondary">
                            {bundle.solveRequest.preferredSprayModeLabel}
                          </Typography>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            sx={compactSelectFieldSx}
                            value={preference.preferredProliferatorMode}
                            onChange={event => {
                              const nextMode = event.target.value as '' | ProliferatorMode;
                              updateRecipePreference(preference.recipeId, {
                                preferredProliferatorMode: nextMode,
                                preferredProliferatorLevel:
                                  nextMode === 'none'
                                    ? ''
                                    : preference.preferredProliferatorLevel,
                              });
                            }}
                            disabled={proliferatorPolicy === 'none'}
                          >
                            <MenuItem value="">{bundle.common.auto}</MenuItem>
                            {modeChoices.map(mode => (
                              <MenuItem key={mode} value={mode}>
                                {formatProliferatorMode(mode, locale)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>

                        <Box sx={{ display: 'grid', gap: 0.75 }}>
                          <Typography variant="overline" color="text.secondary">
                            {bundle.solveRequest.preferredSprayLevelLabel}
                          </Typography>
                          <TextField
                            select
                            fullWidth
                            size="small"
                            sx={compactSelectFieldSx}
                            value={preference.preferredProliferatorLevel === '' ? '' : String(preference.preferredProliferatorLevel)}
                            onChange={event =>
                              updateRecipePreference(preference.recipeId, {
                                preferredProliferatorLevel: event.target.value
                                  ? Number(event.target.value)
                                  : '',
                              })
                            }
                            disabled={levelSelectDisabled}
                          >
                            <MenuItem value="">{bundle.common.auto}</MenuItem>
                            {levelChoices.map(level => (
                              <MenuItem key={level} value={String(level)}>
                                {`${bundle.solveRequest.levelPrefix} ${level}`}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                      </Box>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>

        {/* Advanced overrides collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.solveRequest.advancedOverridesLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <textarea
              value={advancedOverridesText}
              onChange={event => setAdvancedOverridesText(event.target.value)}
              placeholder={'{\n  "preferredBuildingByRecipe": { "1": "5002" },\n  "forcedProliferatorModeByRecipe": { "2": "speed" }\n}'}
              style={{
                ...inputStyle,
                minHeight: 140,
                resize: 'vertical',
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            />
            {parsedOverrides.error ? (
              <div style={{ color: '#8e2020', fontSize: 13 }}>{parsedOverrides.error}</div>
            ) : (
              <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>
                {bundle.solveRequest.advancedOverridesHelp}
              </div>
            )}
          </div>
        </details>

      </div>
    </article>
  );
}
