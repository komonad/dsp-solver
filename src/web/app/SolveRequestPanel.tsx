import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { BalancePolicy, SolveObjective } from '../../solver';
import type { WorkbenchProliferatorPolicy } from '../workbench/requestBuilder';
import ItemGridPicker from '../shared/ItemGridPicker';
import { RecipeOptionLabel, SelectOption } from './SelectOption';
import { pickDefaultGlobalProliferatorLevel } from './workbenchHelpers';
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
    preferredRecipeOptionsByItem,
    allowedRecipesByItem,
    applyAllowedRecipesForItem,
    disabledRecipeIds,
    disabledRecipeDraftId,
    disableRecipeOptions,
    disabledBuildingIds,
    disabledBuildingDraftId,
    disableBuildingOptions,
    preferredBuildings,
    preferredBuildingDraftBuildingId,
    preferredBuildingDraftRecipeId,
    setPreferredBuildingDraftBuildingId,
    setPreferredBuildingDraftRecipeId,
    addPreferredBuilding,
    removePreferredBuilding,
    advancedOverridesText,
    parsedOverrides,
    setTargetPickerQuery,
    setTargetDraftItemId,
    setTargetDraftRatePerMin,
    setObjective,
    setBalancePolicy,
    setProliferatorPolicy,
    setGlobalProliferatorLevel,
    setDisabledRecipeDraftId,
    setDisabledBuildingDraftId,
    setAdvancedOverridesText,
    addTarget,
    addDisabledRecipe,
    removeDisabledRecipe,
    addDisabledBuilding,
    removeDisabledBuilding,
  } = useWorkbench();

  // --- Allowed recipe inline add ---
  const [allowedRecipeDraftItemId, setAllowedRecipeDraftItemId] = useState('');
  const [allowedRecipePickerQuery, setAllowedRecipePickerQuery] = useState('');
  const [allowedRecipeDraftRecipeId, setAllowedRecipeDraftRecipeId] = useState('');
  const [allowedRecipeMessage, setAllowedRecipeMessage] = useState('');
  const allowedRecipeDraftItem = catalog?.itemMap.get(allowedRecipeDraftItemId) ?? null;
  const allowedRecipeOptions = useMemo(
    () => (allowedRecipeDraftItemId ? (preferredRecipeOptionsByItem[allowedRecipeDraftItemId] ?? []) : []),
    [allowedRecipeDraftItemId, preferredRecipeOptionsByItem],
  );

  const allRecipeOptions = catalog?.recipes ?? [];
  const preferredBuildingCompatibleBuildings = useMemo(() => {
    if (!catalog) return [];
    if (!preferredBuildingDraftRecipeId) {
      // Global: show all buildings
      return catalog.buildings;
    }
    const recipe = catalog.recipeMap.get(preferredBuildingDraftRecipeId);
    if (!recipe) return [];
    return catalog.buildings.filter(b => recipe.allowedBuildingIds.includes(b.buildingId));
  }, [catalog, preferredBuildingDraftRecipeId]);

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

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 80px auto', sm: 'minmax(0, 1fr) 80px auto' },
                alignItems: 'center',
              }}
            >
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
                selectedItemName={targetDraftItemOption?.name}
                selectedItemIcon={targetDraftItemOption?.icon}
              />

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

        {/* Allowed recipes collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.summary.forcedRecipesLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr auto', sm: 'minmax(0, 1fr) minmax(0, 1fr) auto' },
                alignItems: 'center',
              }}
            >
              <ItemGridPicker
                items={itemOptions}
                selectedItemId={allowedRecipeDraftItemId}
                query={allowedRecipePickerQuery}
                onQueryChange={setAllowedRecipePickerQuery}
                onSelect={itemId => {
                  setAllowedRecipeDraftItemId(itemId);
                  setAllowedRecipeDraftRecipeId('');
                  setAllowedRecipeMessage('');
                }}
                atlasIds={iconAtlasIds}
                searchLabel={bundle.solveRequest.targetSearchLabel}
                searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
                emptyText={bundle.solveRequest.targetPickerEmpty}
                selectedItemName={allowedRecipeDraftItem?.name}
                selectedItemIcon={allowedRecipeDraftItem?.icon}
              />

              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.summary.forcedRecipesLabel}
                value={allowedRecipeDraftRecipeId}
                disabled={!allowedRecipeDraftItemId || allowedRecipeOptions.length === 0}
                onChange={event => setAllowedRecipeDraftRecipeId(event.target.value)}
              >
                {allowedRecipeOptions.map(o => (
                  <MenuItem
                    key={o.recipeId}
                    value={o.recipeId}
                    disabled={(allowedRecipesByItem[allowedRecipeDraftItemId] ?? []).includes(o.recipeId)}
                  >
                    <RecipeOptionLabel
                      recipeName={o.recipeName}
                      inputs={o.inputs}
                      outputs={o.outputs}
                      cycleTimeSec={o.cycleTimeSec}
                      locale={locale}
                      atlasIds={iconAtlasIds}
                      highlightItemId={allowedRecipeDraftItemId}
                    />
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  if (!allowedRecipeDraftRecipeId || !allowedRecipeDraftItemId) return;
                  const existing = allowedRecipesByItem[allowedRecipeDraftItemId] ?? [];
                  if (existing.includes(allowedRecipeDraftRecipeId)) return;
                  const result = applyAllowedRecipesForItem(
                    allowedRecipeDraftItemId,
                    [...existing, allowedRecipeDraftRecipeId],
                  );
                  if (result.accepted) {
                    setAllowedRecipeDraftRecipeId('');
                    setAllowedRecipeMessage('');
                  } else {
                    setAllowedRecipeMessage(result.message);
                  }
                }}
                disabled={!allowedRecipeDraftRecipeId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.addTarget}
              </Button>
            </Box>

            {allowedRecipeMessage ? (
              <Typography variant="body2" color="warning.main">
                {allowedRecipeMessage}
              </Typography>
            ) : null}
          </div>
        </details>

        {/* Preferred buildings collapsible section */}
        <details style={collapsibleSectionStyle}>
          <summary style={summaryStyle}>{bundle.solveRequest.preferredBuildingsLabel}</summary>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <Box
              sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr auto', sm: 'minmax(0, 200px) minmax(0, 200px) auto' },
                alignItems: 'start',
              }}
            >
              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.summary.recipesLabel}
                value={preferredBuildingDraftRecipeId}
                disabled={!catalog || allRecipeOptions.length === 0}
                onChange={event => {
                  setPreferredBuildingDraftRecipeId(event.target.value);
                  setPreferredBuildingDraftBuildingId('');
                }}
              >
                <MenuItem value="">{bundle.solveRequest.preferredBuildingGlobalScope}</MenuItem>
                {allRecipeOptions.map(recipe => (
                  <MenuItem key={recipe.recipeId} value={recipe.recipeId}>
                    <SelectOption label={recipe.name} iconKey={recipe.icon} size={18} />
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                fullWidth
                size="small"
                sx={compactSelectFieldSx}
                label={bundle.summary.buildingsLabel}
                value={preferredBuildingDraftBuildingId}
                disabled={preferredBuildingCompatibleBuildings.length === 0}
                onChange={event => setPreferredBuildingDraftBuildingId(event.target.value)}
              >
                {preferredBuildingCompatibleBuildings.map(building => (
                  <MenuItem key={building.buildingId} value={building.buildingId}>
                    <SelectOption label={building.name} iconKey={building.icon} size={18} />
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="outlined"
                size="small"
                onClick={addPreferredBuilding}
                disabled={!preferredBuildingDraftBuildingId}
                sx={{ minHeight: 40, px: 1.5 }}
              >
                {bundle.solveRequest.addPreferredBuilding}
              </Button>
            </Box>

            <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
              {preferredBuildings.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{bundle.solveRequest.noPreferredBuildings}</Typography>
              ) : (
                preferredBuildings.map((entry, index) => {
                  const building = catalog?.buildingMap.get(entry.buildingId);
                  const recipe = entry.recipeId ? catalog?.recipeMap.get(entry.recipeId) : null;
                  const label = `${building?.name ?? entry.buildingId}: ${recipe ? recipe.name : '*'}`;
                  return (
                    <Chip
                      key={`${entry.buildingId}:${entry.recipeId}:${index}`}
                      label={label}
                      onDelete={() => removePreferredBuilding(index)}
                    />
                  );
                })
              )}
            </Stack>
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
