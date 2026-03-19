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
import React from 'react';
import { formatPower, formatRate, getLocaleBundle, type AppLocale } from '../i18n';
import { getWorkbenchExtraBundle } from '../i18n/workbenchExtra';
import type { PresentationItemRate, PresentationItemSlice } from '../presentation';
import { EntityLabel } from './EntityIcon';

interface ItemSlicePanelProps {
  locale: AppLocale;
  atlasIds?: string[];
  slice?: PresentationItemSlice;
  preferredRecipeId?: string;
  preferredRecipeOptions: Array<{
    recipeId: string;
    recipeName: string;
    recipeIconKey?: string;
  }>;
  onSelectItem: (itemId: string) => void;
  onMarkRaw: (itemId: string) => void;
  onUnmarkRaw: (itemId: string) => void;
  onPreferredRecipeChange: (itemId: string, recipeId: string) => void;
  onClearPreferredRecipe: (itemId: string) => void;
  onLocateInLedger: (itemId: string) => void;
}

function renderRateList(
  items: PresentationItemRate[],
  locale: AppLocale,
  onSelectItem: (itemId: string) => void,
  atlasIds?: string[]
) {
  return (
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
      {items.map(item => (
        <Button
          key={item.itemId}
          variant="outlined"
          color="inherit"
          onClick={() => onSelectItem(item.itemId)}
          sx={{
            borderRadius: 999,
            gap: 1,
            borderColor: 'divider',
            backgroundColor: 'rgba(22, 54, 89, 0.04)',
          }}
        >
          <EntityLabel
            label={item.itemName}
            iconKey={item.iconKey}
            atlasIds={atlasIds}
            size={18}
            gap={6}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
          <Typography variant="caption" color="text.secondary">
            {formatRate(item.ratePerMin, locale)}
          </Typography>
        </Button>
      ))}
    </Stack>
  );
}

function buildPlanCardTitle(recipeName: string, buildingName: string) {
  return `${recipeName} / ${buildingName}`;
}

export default function ItemSlicePanel(props: ItemSlicePanelProps) {
  const {
    locale,
    atlasIds,
    slice,
    preferredRecipeId,
    preferredRecipeOptions,
    onSelectItem,
    onMarkRaw,
    onUnmarkRaw,
    onPreferredRecipeChange,
    onClearPreferredRecipe,
    onLocateInLedger,
  } = props;
  const bundle = getWorkbenchExtraBundle(locale);
  const localeBundle = getLocaleBundle(locale);

  if (!slice) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{bundle.itemSlice.title}</Typography>
        <Card sx={{ borderRadius: '18px', overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, backgroundColor: 'rgba(22, 54, 89, 0.03)' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {bundle.itemSlice.emptyTitle}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {bundle.itemSlice.emptyDescription}
            </Typography>
          </Box>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">
            {bundle.itemSlice.title}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <EntityLabel
              label={slice.itemName}
              iconKey={slice.iconKey}
              atlasIds={atlasIds}
              size={26}
              gap={10}
              textStyle={{ fontSize: 22, fontWeight: 700 }}
            />
          </Box>
        </Box>
        <Button variant="outlined" onClick={() => onLocateInLedger(slice.itemId)}>
          {bundle.itemSlice.openInLedgerButton}
        </Button>
      </Stack>

      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
        {slice.isRawInput ? (
          <Chip label={localeBundle.itemLedger.rawBadge} color="primary" variant="outlined" />
        ) : null}
        {slice.isTarget ? (
          <Chip label={localeBundle.itemLedger.targetBadge} color="warning" variant="outlined" />
        ) : null}
        {slice.surplusRatePerMin > 1e-8 ? (
          <Chip label={localeBundle.itemLedger.surplusBadge} color="success" variant="outlined" />
        ) : null}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 1.5,
        }}
      >
        {[
          {
            label: localeBundle.diagnostics.producedLabel,
            value: formatRate(slice.producedRatePerMin, locale),
          },
          {
            label: localeBundle.diagnostics.consumedLabel,
            value: formatRate(slice.consumedRatePerMin, locale),
          },
          {
            label: localeBundle.diagnostics.netLabel,
            value: formatRate(slice.netRatePerMin, locale),
          },
          {
            label: bundle.itemSlice.targetRateLabel,
            value: formatRate(slice.targetRatePerMin, locale),
          },
          {
            label: bundle.itemSlice.externalInputLabel,
            value: formatRate(slice.externalInputRatePerMin, locale),
          },
          {
            label: bundle.itemSlice.surplusLabel,
            value: formatRate(slice.surplusRatePerMin, locale),
          },
        ].map(entry => (
          <Card key={entry.label} sx={{ borderRadius: '16px', overflow: 'hidden' }}>
            <Box sx={{ p: 1.75 }}>
              <Typography variant="overline" color="text.secondary">
                {entry.label}
              </Typography>
              <Typography variant="subtitle1" fontWeight={700}>
                {entry.value}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box>

      <Card sx={{ borderRadius: '18px', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            {bundle.itemSlice.preferredRecipeLabel}
          </Typography>
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
            {slice.isRawInput ? (
              <Button variant="outlined" onClick={() => onUnmarkRaw(slice.itemId)}>
                {localeBundle.itemLedger.unmarkRawButton}
              </Button>
            ) : (
              <Button variant="contained" onClick={() => onMarkRaw(slice.itemId)}>
                {localeBundle.itemLedger.markRawButton}
              </Button>
            )}

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id={`preferred-recipe-${slice.itemId}`}>
                {bundle.itemSlice.preferredRecipeLabel}
              </InputLabel>
              <Select
                labelId={`preferred-recipe-${slice.itemId}`}
                value={preferredRecipeId ?? ''}
                label={bundle.itemSlice.preferredRecipeLabel}
                onChange={event =>
                  onPreferredRecipeChange(slice.itemId, String(event.target.value))
                }
              >
                <MenuItem value="">{bundle.itemSlice.noPreferredRecipe}</MenuItem>
                {preferredRecipeOptions.map(option => (
                  <MenuItem key={option.recipeId} value={option.recipeId}>
                    {option.recipeName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="text"
              color="inherit"
              onClick={() => onClearPreferredRecipe(slice.itemId)}
              disabled={!preferredRecipeId}
            >
              {bundle.itemSlice.clearPreferredRecipeButton}
            </Button>
          </Stack>
        </Box>
      </Card>

      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">
          {bundle.itemSlice.producersTitle}
        </Typography>
        {slice.producerPlans.length > 0 ? (
          slice.producerPlans.map(plan => (
            <Card
              key={`producer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`}
              sx={{ borderRadius: '18px', overflow: 'hidden' }}
            >
              <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
                <Box>
                  <EntityLabel
                    label={buildPlanCardTitle(plan.recipeName, plan.buildingName)}
                    iconKey={plan.recipeIconKey}
                    atlasIds={atlasIds}
                    size={22}
                    gap={8}
                    textStyle={{ fontWeight: 700 }}
                  />
                  <Stack
                    direction="row"
                    useFlexGap
                    flexWrap="wrap"
                    gap={1}
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    <Typography variant="caption">
                      产出 {formatRate(plan.itemRatePerMin, locale)}
                    </Typography>
                    <Typography variant="caption">{plan.proliferatorLabel}</Typography>
                    <Typography variant="caption">{plan.roundedUpBuildingCount} 台</Typography>
                    <Typography variant="caption">
                      {formatPower(plan.roundedPlacementPowerMW, locale)}
                    </Typography>
                  </Stack>
                </Box>
                <Divider />
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {localeBundle.recipePlans.inputsLabel}
                </Typography>
                {renderRateList(plan.inputs, locale, onSelectItem, atlasIds)}
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {localeBundle.recipePlans.outputsLabel}
                </Typography>
                {renderRateList(plan.outputs, locale, onSelectItem, atlasIds)}
              </Box>
            </Card>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {bundle.itemSlice.noProducerPlans}
          </Typography>
        )}
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">
          {bundle.itemSlice.consumersTitle}
        </Typography>
        {slice.consumerPlans.length > 0 ? (
          slice.consumerPlans.map(plan => (
            <Card
              key={`consumer-${slice.itemId}-${plan.recipeId}-${plan.buildingId}-${plan.proliferatorLabel}`}
              sx={{ borderRadius: '18px', overflow: 'hidden' }}
            >
              <Box sx={{ p: 2, display: 'grid', gap: 1.5 }}>
                <Box>
                  <EntityLabel
                    label={buildPlanCardTitle(plan.recipeName, plan.buildingName)}
                    iconKey={plan.recipeIconKey}
                    atlasIds={atlasIds}
                    size={22}
                    gap={8}
                    textStyle={{ fontWeight: 700 }}
                  />
                  <Stack
                    direction="row"
                    useFlexGap
                    flexWrap="wrap"
                    gap={1}
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    <Typography variant="caption">
                      消耗 {formatRate(plan.itemRatePerMin, locale)}
                    </Typography>
                    <Typography variant="caption">{plan.proliferatorLabel}</Typography>
                    <Typography variant="caption">{plan.roundedUpBuildingCount} 台</Typography>
                    <Typography variant="caption">
                      {formatPower(plan.roundedPlacementPowerMW, locale)}
                    </Typography>
                  </Stack>
                </Box>
                <Divider />
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {localeBundle.recipePlans.inputsLabel}
                </Typography>
                {renderRateList(plan.inputs, locale, onSelectItem, atlasIds)}
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {localeBundle.recipePlans.outputsLabel}
                </Typography>
                {renderRateList(plan.outputs, locale, onSelectItem, atlasIds)}
              </Box>
            </Card>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {bundle.itemSlice.noConsumerPlans}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}
