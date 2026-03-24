import React from 'react';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import {
  Box,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { ProliferatorMode } from '../../catalog';
import { formatPower, formatProliferatorMode, formatRate } from '../../i18n';
import type { PresentationModel } from '../../presentation';
import { EntityIcon, EntityLabel, EntityLabelButton } from '../shared/EntityIcon';
import { openItemSliceOverlay } from '../itemSlice/itemSliceStore';
import { buildRecipeFlowDisplay } from '../shared/recipeDisplay';
import type { EditableRecipeStrategyOverride } from '../workbench/requestBuilder';
import { FlowRateSequence } from './FlowRateDisplay';
import { SelectOption } from './SelectOption';
import { useWorkbench } from './WorkbenchContext';
import { compactSelectFieldSx } from './workbenchStyles';

export interface RecipePlanCardProps {
  plan: PresentationModel['recipePlans'][number];
  override?: EditableRecipeStrategyOverride;
}

const RecipePlanCard = React.memo(function RecipePlanCard({
  plan,
  override,
}: RecipePlanCardProps) {
  const {
    bundle,
    locale,
    iconAtlasIds,
    catalog,
    applyRecipeStrategyPatch,
    getRecipeBuildingOptions,
    getRecipeModeOptions,
    getRecipeLevelOptions,
  } = useWorkbench();

  const { visibleInputs, auxiliaryProliferatorInput } = buildRecipeFlowDisplay(catalog, plan);
  const buildingChoices = getRecipeBuildingOptions(plan.recipeId);
  const modeChoices = getRecipeModeOptions(plan.recipeId);
  const levelChoices = getRecipeLevelOptions(plan.recipeId);
  const selectedMode = override?.forcedProliferatorMode ?? '';
  const selectedLevel =
    selectedMode === 'none'
      ? ''
      : typeof override?.forcedProliferatorLevel === 'number' &&
          override.forcedProliferatorLevel > 0
        ? String(override.forcedProliferatorLevel)
        : '';
  const levelSelectDisabled =
    levelChoices.length === 0 || selectedMode === '' || selectedMode === 'none';

  return (
    <Card
      sx={{
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        backgroundColor: 'rgba(255,255,255,0.68)',
        overflow: 'hidden',
        contentVisibility: 'auto',
        containIntrinsicSize: '152px 480px',
        contain: 'layout paint style',
      }}
    >
      <CardContent
        sx={{
          display: 'grid',
          gap: 1.5,
          p: 2,
          borderRadius: '18px',
          '&:last-child': { pb: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 1.25,
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              alignItems: 'center',
              minWidth: 0,
              width: '100%',
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ minWidth: 0, flex: '1 1 220px' }}
            >
              <EntityLabel
                label={plan.recipeName}
                iconKey={plan.recipeIconKey}
                atlasIds={iconAtlasIds}
                size={20}
                gap={8}
                textStyle={{ fontWeight: 700 }}
              />
            </Typography>
            <Stack
              direction="row"
              useFlexGap
              flexWrap="wrap"
              gap={0.75}
              sx={{
                color: 'text.secondary',
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                <EntityLabel
                  label={`${bundle.summary.buildingsLabel} ${plan.buildingName} X ${plan.exactBuildingCount.toFixed(2)}`}
                  iconKey={plan.buildingIconKey}
                  atlasIds={iconAtlasIds}
                  size={16}
                />
              </Typography>
              <Typography variant="caption">{plan.proliferatorLabel}</Typography>
              <Typography variant="caption">
                {bundle.overview.requestLabel} {formatRate(plan.runsPerMin, locale)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bundle.recipePlans.powerLabel} {formatPower(plan.activePowerMW, locale)}
              </Typography>
            </Stack>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {bundle.summary.buildingsLabel}
            </Typography>
            <Select
              size="small"
              displayEmpty
              value={override?.forcedBuildingId ?? ''}
              onChange={event =>
                applyRecipeStrategyPatch(plan.recipeId, {
                  forcedBuildingId: String(event.target.value),
                })
              }
              sx={{
                ...compactSelectFieldSx,
                minWidth: 128,
                '& .MuiSelect-select': {
                  py: 0.75,
                  pr: '28px !important',
                  fontSize: 13,
                },
              }}
              renderValue={selected =>
                selected
                  ? (
                      <SelectOption
                        label={
                          buildingChoices.find(building => building.buildingId === selected)?.name ??
                          String(selected)
                        }
                        iconKey={buildingChoices.find(building => building.buildingId === selected)
                          ?.icon}
                        size={16}
                      />
                    )
                  : bundle.common.auto
              }
            >
              <MenuItem value="">{bundle.common.auto}</MenuItem>
              {buildingChoices.map(building => (
                <MenuItem key={building.buildingId} value={building.buildingId}>
                  <SelectOption label={building.name} iconKey={building.icon} size={16} />
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {bundle.solveRequest.preferredSprayModeLabel}
            </Typography>
            <Select
              size="small"
              displayEmpty
              value={selectedMode}
              onChange={event => {
                const nextMode = event.target.value as '' | ProliferatorMode;
                applyRecipeStrategyPatch(plan.recipeId, {
                  forcedProliferatorMode: nextMode,
                  forcedProliferatorLevel:
                    nextMode === 'none'
                      ? 0
                      : nextMode
                        ? typeof override?.forcedProliferatorLevel === 'number' &&
                            override.forcedProliferatorLevel > 0
                          ? override.forcedProliferatorLevel
                          : ''
                        : '',
                });
              }}
              sx={{
                ...compactSelectFieldSx,
                minWidth: 118,
                '& .MuiSelect-select': {
                  py: 0.75,
                  pr: '28px !important',
                  fontSize: 13,
                },
              }}
              renderValue={selected =>
                selected
                  ? formatProliferatorMode(selected as ProliferatorMode, locale)
                  : bundle.common.auto
              }
            >
              <MenuItem value="">{bundle.common.auto}</MenuItem>
              {modeChoices.map(mode => (
                <MenuItem key={mode} value={mode}>
                  {formatProliferatorMode(mode, locale)}
                </MenuItem>
              ))}
            </Select>
          </Box>

          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {bundle.solveRequest.preferredSprayLevelLabel}
            </Typography>
            <Select
              size="small"
              displayEmpty
              value={selectedLevel}
              disabled={levelSelectDisabled}
              onChange={event =>
                applyRecipeStrategyPatch(plan.recipeId, {
                  forcedProliferatorLevel: event.target.value
                    ? Number(event.target.value)
                    : '',
                })
              }
              sx={{
                ...compactSelectFieldSx,
                minWidth: 88,
                '& .MuiSelect-select': {
                  py: 0.75,
                  pr: '28px !important',
                  fontSize: 13,
                },
              }}
              renderValue={selected =>
                selected
                  ? `${bundle.solveRequest.levelPrefix} ${selected}`
                  : bundle.common.auto
              }
            >
              <MenuItem value="">{bundle.common.auto}</MenuItem>
              {levelChoices.map(level => (
                <MenuItem key={level} value={String(level)}>
                  {`${bundle.solveRequest.levelPrefix} ${level}`}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            borderRadius: '16px',
            px: 1.25,
            py: 1,
            backgroundColor: 'rgba(22, 54, 89, 0.035)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              flex: '1 1 260px',
              minWidth: 0,
            }}
          >
            <FlowRateSequence items={visibleInputs} />
          </Box>
          <EastRoundedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              flex: '1 1 220px',
              minWidth: 0,
            }}
          >
            <FlowRateSequence items={plan.outputs} />
            {auxiliaryProliferatorInput ? (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  whiteSpace: 'nowrap',
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span>+</span>
                <EntityLabelButton
                  label={auxiliaryProliferatorInput.itemName}
                  iconKey={auxiliaryProliferatorInput.iconKey}
                  atlasIds={iconAtlasIds}
                  size={16}
                  gap={6}
                  textStyle={{ fontSize: 12, fontWeight: 600 }}
                  buttonStyle={{
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onClick={() => openItemSliceOverlay(auxiliaryProliferatorInput.itemId)}
                />
                <span>{formatRate(auxiliaryProliferatorInput.ratePerMin, locale)}</span>
              </Box>
            ) : null}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

export default RecipePlanCard;
