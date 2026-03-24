import {
  Alert,
  Box,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ResolvedCatalogModel, ResolvedRecipeSpec } from '../../catalog';
import type { AppLocale } from '../../i18n';
import {
  formatBalancePolicy,
  formatSolveObjective,
  formatSolveStatus,
} from '../../i18n';
import { EntityIcon } from '../shared/EntityIcon';
import { ClickableItemLabel } from './ClickableItemLabel';
import { RecipeIoSequence } from './FlowRateDisplay';
import RecipeCycleArrow from './RecipeCycleArrow';
import RecipeConstraintSnapshotList from './RecipeConstraintSnapshotList';
import SnapshotRemoveButton from './SnapshotRemoveButton';
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

export default function SolveSnapshotPanel() {
  const {
    bundle,
    locale,
    catalog,
    iconAtlasIds,
    model,
    targets,
    objective,
    balancePolicy,
    hasTargets,
    requestSummary,
    solveError,
    preferredBuildings,
    updateTarget,
    removeTarget,
    removeAllowedRecipeForItem,
    removeDisabledRecipe,
    removePreferredBuilding,
  } = useWorkbench();

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 12 }}>
      <Typography variant="h6">{bundle.summary.solveSnapshotTitle}</Typography>
      {solveError && hasTargets ? <Alert severity="error">{solveError}</Alert> : null}
      {requestSummary ? (
        <>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
            {requestSummary.solverVersion ? (
              <Chip
                size="small"
                variant="outlined"
                label={`${bundle.summary.solverVersionLabel}: ${requestSummary.solverVersion}`}
              />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={`${bundle.summary.objectiveLabel}: ${formatSolveObjective(objective, locale)}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${bundle.summary.balanceLabel}: ${formatBalancePolicy(balancePolicy, locale)}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${bundle.summary.sprayLabel}: ${requestSummary.proliferatorPolicyLabel ?? bundle.common.notSet}`}
            />
            <Chip
              size="small"
              variant="outlined"
              color={model?.status === 'optimal' ? 'success' : 'default'}
              label={`${bundle.summary.statusLabel}: ${formatSolveStatus(model?.status ?? null, locale)}`}
            />
          </Stack>

          <Divider />

          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              {bundle.summary.targetsLabel}
            </Typography>
            {requestSummary.targets.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {bundle.common.none}
              </Typography>
            ) : (
              requestSummary.targets.map((target, index) => (
                <Box key={`${target.itemId}:${index}`} sx={snapshotTargetEntrySx}>
                  <Box
                    sx={{
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
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
          </Stack>

          <RecipeConstraintSnapshotList
            title={bundle.summary.forcedRecipesLabel}
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
          />

          <RecipeConstraintSnapshotList
            title={bundle.summary.disabledRecipesLabel}
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
          />

          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              {bundle.summary.preferredBuildingsLabel}
            </Typography>
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
                    <Box key={`${entry.buildingId}:${entry.recipeId}:${index}`} sx={snapshotEntryGroupSx}>
                      <Box
                        sx={{
                          ...snapshotEntryCapsuleSx,
                        }}
                      >
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
                                <RecipeFlowSummary
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
          </Stack>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {bundle.summary.loadDatasetToStart}
        </Typography>
      )}
    </article>
  );
}

function RecipeFlowSummary({
  recipe,
  locale,
  atlasIds,
  noneText,
  catalog,
}: {
  recipe: ResolvedRecipeSpec;
  locale: AppLocale;
  atlasIds?: string[];
  noneText: string;
  catalog: ResolvedCatalogModel | null;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        flexWrap: 'wrap',
        minWidth: 0,
        maxWidth: '100%',
        flex: '1 1 auto',
      }}
    >
      <Box sx={{ minWidth: 0, display: 'flex', maxWidth: '100%' }}>
        <RecipeIoSequence
          items={recipe.inputs.map(io => {
            const item = catalog?.itemMap.get(io.itemId);
            return {
              itemId: io.itemId,
              itemName: item?.name ?? io.itemId,
              iconKey: item?.icon,
              ratePerMin: io.amount,
            };
          })}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
      <RecipeCycleArrow cycleTimeSec={recipe.cycleTimeSec} locale={locale} />
      <Box sx={{ minWidth: 0, display: 'flex', maxWidth: '100%' }}>
        <RecipeIoSequence
          items={recipe.outputs.map(io => {
            const item = catalog?.itemMap.get(io.itemId);
            return {
              itemId: io.itemId,
              itemName: item?.name ?? io.itemId,
              iconKey: item?.icon,
              ratePerMin: io.amount,
            };
          })}
          locale={locale}
          atlasIds={atlasIds}
          noneText={noneText}
        />
      </Box>
    </Box>
  );
}
