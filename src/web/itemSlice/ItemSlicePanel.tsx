import {
  Box,
  Button,
  Card,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { formatPower, formatRate, getLocaleBundle, type AppLocale } from '../../i18n';
import { getWorkbenchExtraBundle } from '../../i18n/workbenchExtra';
import type { PresentationItemSlice } from '../../presentation';
import { EntityLabel, EntityLabelButton } from '../shared/EntityIcon';
import { FlowRateSequence } from '../app/components/FlowRateDisplay';
import { RecipeOptionLabel, type RecipeOptionIO } from '../app/components/SelectOption';

interface ItemSlicePanelProps {
  locale: AppLocale;
  atlasIds?: string[];
  slice?: PresentationItemSlice;
  preferredRecipeIds: string[];
  preferredRecipeOptions: Array<{
    recipeId: string;
    recipeName: string;
    recipeIconKey?: string;
    cycleTimeSec: number;
    inputs: RecipeOptionIO[];
    outputs: RecipeOptionIO[];
  }>;
  onSelectItem: (itemId: string) => void;
  onMarkRaw: (itemId: string) => void;
  onUnmarkRaw: (itemId: string) => void;
  onApplyPreferredRecipes: (itemId: string, recipeIds: string[]) => { accepted: boolean; message: string };
  onClearPreferredRecipe: (itemId: string) => void;
  onLocateInLedger: (itemId: string) => void;
}

function buildPlanCardTitle(recipeName: string, buildingName: string) {
  return `${recipeName} / ${buildingName}`;
}

function ItemSlicePanel(props: ItemSlicePanelProps) {
  const {
    locale,
    atlasIds,
    slice,
    preferredRecipeIds = [],
    preferredRecipeOptions,
    onSelectItem,
    onMarkRaw,
    onUnmarkRaw,
    onApplyPreferredRecipes,
    onClearPreferredRecipe,
    onLocateInLedger,
  } = props;
  const bundle = getWorkbenchExtraBundle(locale);
  const localeBundle = getLocaleBundle(locale);
  const [draftRecipeIds, setDraftRecipeIds] = useState<string[]>(preferredRecipeIds);
  const [draftMessage, setDraftMessage] = useState('');

  useEffect(() => {
    setDraftRecipeIds(preferredRecipeIds);
    setDraftMessage('');
  }, [preferredRecipeIds, slice?.itemId]);

  const hasPendingChanges = useMemo(() => {
    if (draftRecipeIds.length !== preferredRecipeIds.length) {
      return true;
    }
    return draftRecipeIds.some(recipeId => !preferredRecipeIds.includes(recipeId));
  }, [draftRecipeIds, preferredRecipeIds]);

  if (!slice) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{bundle.itemSlice.title}</Typography>
        <Card sx={{ borderRadius: '18px', overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, backgroundColor: 'rgba(22, 54, 89, 0.03)' }}>
            <Typography variant="subtitle1" fontWeight={700}>{bundle.itemSlice.emptyTitle}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{bundle.itemSlice.emptyDescription}</Typography>
          </Box>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">{bundle.itemSlice.title}</Typography>
          <Box sx={{ mt: 0.5 }}>
            <EntityLabelButton
              label={slice.itemName}
              iconKey={slice.iconKey}
              atlasIds={atlasIds}
              size={26}
              gap={10}
              textStyle={{ fontSize: 22, fontWeight: 700 }}
              buttonStyle={{ display: 'inline-flex', alignItems: 'center' }}
              onClick={() => onSelectItem(slice.itemId)}
            />
          </Box>
        </Box>
        <Button variant="outlined" onClick={() => onLocateInLedger(slice.itemId)}>{bundle.itemSlice.openInLedgerButton}</Button>
      </Stack>

      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
        {slice.isRawInput ? <Chip label={localeBundle.itemLedger.rawBadge} color="primary" variant="outlined" /> : null}
        {slice.isTarget ? <Chip label={localeBundle.itemLedger.targetBadge} color="warning" variant="outlined" /> : null}
        {slice.surplusRatePerMin > 1e-8 ? <Chip label={localeBundle.itemLedger.surplusBadge} color="success" variant="outlined" /> : null}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
        {[
          { label: localeBundle.diagnostics.producedLabel, value: formatRate(slice.producedRatePerMin, locale) },
          { label: localeBundle.diagnostics.consumedLabel, value: formatRate(slice.consumedRatePerMin, locale) },
          { label: localeBundle.diagnostics.netLabel, value: formatRate(slice.netRatePerMin, locale) },
          { label: bundle.itemSlice.targetRateLabel, value: formatRate(slice.targetRatePerMin, locale) },
          { label: bundle.itemSlice.externalInputLabel, value: formatRate(slice.externalInputRatePerMin, locale) },
          { label: bundle.itemSlice.surplusLabel, value: formatRate(slice.surplusRatePerMin, locale) },
        ].map(entry => (
          <Card key={entry.label} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
            <Box sx={{ p: 1.75 }}>
              <Typography variant="overline" color="text.secondary">{entry.label}</Typography>
              <Typography variant="subtitle1" fontWeight={700}>{entry.value}</Typography>
            </Box>
          </Card>
        ))}
      </Box>

      <Card sx={{ borderRadius: '18px', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
          <Typography variant="overline" color="text.secondary">{bundle.itemSlice.forcedRecipeLabel}</Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            {slice.isRawInput ? (
              <Button variant="outlined" onClick={() => onUnmarkRaw(slice.itemId)}>{localeBundle.itemLedger.unmarkRawButton}</Button>
            ) : (
              <Button variant="contained" onClick={() => onMarkRaw(slice.itemId)}>{localeBundle.itemLedger.markRawButton}</Button>
            )}

            <FormControl size="small" sx={{ minWidth: 260, flex: '1 1 260px' }}>
              <InputLabel id={`preferred-recipe-${slice.itemId}`}>{bundle.itemSlice.forcedRecipeLabel}</InputLabel>
              <Select
                labelId={`preferred-recipe-${slice.itemId}`}
                multiple
                value={draftRecipeIds}
                label={bundle.itemSlice.forcedRecipeLabel}
                onChange={event =>
                  setDraftRecipeIds(
                    (Array.isArray(event.target.value) ? event.target.value : [String(event.target.value)]).filter(Boolean)
                  )
                }
                renderValue={selected =>
                  preferredRecipeOptions
                    .filter(option => (selected as string[]).includes(option.recipeId))
                    .map(option => option.recipeName)
                    .join(' / ')
                }
              >
                {preferredRecipeOptions.map(option => (
                  <MenuItem key={option.recipeId} value={option.recipeId}>
                    <RecipeOptionLabel
                      recipeName={option.recipeName}
                      inputs={option.inputs}
                      outputs={option.outputs}
                      cycleTimeSec={option.cycleTimeSec}
                      locale={locale}
                      atlasIds={atlasIds}
                      highlightItemId={slice.itemId}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {draftMessage ? <Typography variant="body2" color="warning.main">{draftMessage}</Typography> : null}
          {hasPendingChanges ? <Typography variant="caption" color="text.secondary">未应用更改</Typography> : null}

          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            <Button
              variant="contained"
              onClick={() => {
                const result = onApplyPreferredRecipes(slice.itemId, draftRecipeIds);
                setDraftMessage(result.accepted ? '' : result.message);
              }}
              disabled={!hasPendingChanges}
            >
              保存
            </Button>
            <Button variant="outlined" onClick={() => { setDraftRecipeIds(preferredRecipeIds); setDraftMessage(''); }} disabled={!hasPendingChanges}>
              重置
            </Button>
            <Button variant="text" color="inherit" onClick={() => { onClearPreferredRecipe(slice.itemId); setDraftRecipeIds([]); setDraftMessage(''); }} disabled={preferredRecipeIds.length === 0 && draftRecipeIds.length === 0}>
              {bundle.itemSlice.clearForcedRecipeButton}
            </Button>
          </Stack>
        </Box>
      </Card>

      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">{bundle.itemSlice.producersTitle}</Typography>
        {slice.producerPlans.length > 0 ? slice.producerPlans.map(plan => (
          <Card key={`producer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`} sx={{ borderRadius: '18px', overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
              <Box>
                <EntityLabel label={buildPlanCardTitle(plan.recipeName, plan.buildingName)} iconKey={plan.recipeIconKey} atlasIds={atlasIds} size={22} gap={8} textStyle={{ fontWeight: 700 }} />
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1, color: 'text.secondary' }}>
                  <Typography variant="caption">产出 {formatRate(plan.itemRatePerMin, locale)}</Typography>
                  <Typography variant="caption">{plan.proliferatorLabel}</Typography>
                  <Typography variant="caption">{plan.roundedUpBuildingCount} 台</Typography>
                  <Typography variant="caption">{formatPower(plan.roundedPlacementPowerMW, locale)}</Typography>
                </Stack>
              </Box>
              <Divider />
              <Typography variant="caption" color="text.secondary" fontWeight={700}>{localeBundle.recipePlans.inputsLabel}</Typography>
              <FlowRateSequence items={plan.inputs} locale={locale} atlasIds={atlasIds} noneText={localeBundle.common.none} />
              <Typography variant="caption" color="text.secondary" fontWeight={700}>{localeBundle.recipePlans.outputsLabel}</Typography>
              <FlowRateSequence items={plan.outputs} locale={locale} atlasIds={atlasIds} noneText={localeBundle.common.none} />
            </Box>
          </Card>
        )) : <Typography variant="body2" color="text.secondary">{bundle.itemSlice.noProducerPlans}</Typography>}
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">{bundle.itemSlice.consumersTitle}</Typography>
        {slice.consumerPlans.length > 0 ? slice.consumerPlans.map(plan => (
          <Card key={`consumer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`} sx={{ borderRadius: '18px', overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
              <Box>
                <EntityLabel label={buildPlanCardTitle(plan.recipeName, plan.buildingName)} iconKey={plan.recipeIconKey} atlasIds={atlasIds} size={22} gap={8} textStyle={{ fontWeight: 700 }} />
                <Stack direction="row" useFlexGap flexWrap="wrap" gap={1} sx={{ mt: 1, color: 'text.secondary' }}>
                  <Typography variant="caption">消耗 {formatRate(plan.itemRatePerMin, locale)}</Typography>
                  <Typography variant="caption">{plan.proliferatorLabel}</Typography>
                  <Typography variant="caption">{plan.roundedUpBuildingCount} 台</Typography>
                  <Typography variant="caption">{formatPower(plan.roundedPlacementPowerMW, locale)}</Typography>
                </Stack>
              </Box>
              <Divider />
              <Typography variant="caption" color="text.secondary" fontWeight={700}>{localeBundle.recipePlans.inputsLabel}</Typography>
              <FlowRateSequence items={plan.inputs} locale={locale} atlasIds={atlasIds} noneText={localeBundle.common.none} />
              <Typography variant="caption" color="text.secondary" fontWeight={700}>{localeBundle.recipePlans.outputsLabel}</Typography>
              <FlowRateSequence items={plan.outputs} locale={locale} atlasIds={atlasIds} noneText={localeBundle.common.none} />
            </Box>
          </Card>
        )) : <Typography variant="body2" color="text.secondary">{bundle.itemSlice.noConsumerPlans}</Typography>}
      </Stack>
    </Stack>
  );
}

export default React.memo(ItemSlicePanel);
