import React from 'react';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { Box, Card, CardContent, Typography } from '@mui/material';
import type { ProliferatorMode } from '../../../catalog';
import { formatProliferatorMode } from '../../../i18n';
import type { PresentationModel } from '../../../presentation';
import { EntityIcon } from '../../shared/EntityIcon';
import {
  RecipePlanAuxiliaryInput,
  RecipePlanFlowSequence,
  RecipePlanToggleButton,
  RecipePlanToggleGroup,
} from './RecipePlanCardParts';
import { useWorkbench } from '../WorkbenchContext';
import { buildRecipePlanCardDisplayModel } from '../workbenchHelpers';

export interface RecipePlanCardProps {
  plan: PresentationModel['recipePlans'][number];
}

const BUILDING_CONTROL_LABEL = '\u5efa\u7b51\u9009\u62e9';
const PROLIFERATOR_MODE_CONTROL_LABEL = '\u589e\u4ea7\u7b56\u7565';
const PROLIFERATOR_LEVEL_CONTROL_LABEL = '\u589e\u4ea7\u7b49\u7ea7';
const NONE_OPTION_LABEL = '\u2205';

function AutoOptionGlyph() {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        fontSize: 15,
        lineHeight: 1,
        transform: 'translateY(0.5px)',
      }}
    >
      *
    </Box>
  );
}

const RecipePlanCard = React.memo(function RecipePlanCard({ plan }: RecipePlanCardProps) {
  const {
    bundle,
    locale,
    iconAtlasIds,
    catalog,
    recipePreferences,
    recipeStrategyOverrides,
    preferredBuildings,
    applyRecipeStrategyPatch,
    getRecipeBuildingOptions,
    getRecipeModeOptions,
    getRecipeLevelOptions,
    setRecipePreferredBuilding,
    setRecipePreferredProliferator,
  } = useWorkbench();

  const displayModel = buildRecipePlanCardDisplayModel(catalog, plan, locale);
  const buildingChoices = getRecipeBuildingOptions(plan.recipeId);
  const modeChoices = getRecipeModeOptions(plan.recipeId);
  const levelChoices = getRecipeLevelOptions(plan.recipeId);
  const preference = recipePreferences.find(entry => entry.recipeId === plan.recipeId);
  const override = recipeStrategyOverrides.find(entry => entry.recipeId === plan.recipeId);
  const preferredBuilding = preferredBuildings.find(entry => entry.recipeId === plan.recipeId);
  const selectedBuildingId =
    override?.forcedBuildingId ||
    preferredBuilding?.buildingId ||
    preference?.preferredBuildingId ||
    '';
  const selectedMode =
    override?.forcedProliferatorMode || preference?.preferredProliferatorMode || '';
  const selectedLevelValue =
    typeof override?.forcedProliferatorLevel === 'number'
      ? override.forcedProliferatorLevel
      : typeof preference?.preferredProliferatorLevel === 'number'
        ? preference.preferredProliferatorLevel
        : '';
  const selectedLevel =
    selectedMode === 'none'
      ? ''
      : typeof selectedLevelValue === 'number' && selectedLevelValue > 0
        ? String(selectedLevelValue)
        : '';
  const levelSelectDisabled =
    levelChoices.length === 0 || selectedMode === '' || selectedMode === 'none';

  return (
    <Card
      data-testid="recipe-plan-card"
      sx={{
        borderRadius: '20px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        backgroundColor: 'rgba(255,255,255,0.68)',
        overflow: 'hidden',
        contentVisibility: 'auto',
        containIntrinsicSize: '128px 480px',
        contain: 'layout paint style',
      }}
    >
      <CardContent
        sx={{
          display: 'grid',
          gap: 1.25,
          p: 2,
          borderRadius: '18px',
          '&:last-child': { pb: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 1,
            flexWrap: { xs: 'wrap', md: 'nowrap' },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 0.875,
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              noWrap
              title={plan.recipeName}
              sx={{ minWidth: 0, flex: '1 1 auto' }}
            >
              {plan.recipeName}
            </Typography>

            <Box
              sx={{
                flex: '0 1 auto',
                minWidth: 0,
                ml: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                rowGap: 0.25,
                columnGap: 1.375,
              }}
            >
              <RecipePlanToggleGroup
                ariaLabel={`${plan.recipeName} ${BUILDING_CONTROL_LABEL}`}
                value={selectedBuildingId}
                testId="recipe-plan-building-toggle-group"
                onChange={nextBuildingId => {
                  const accepted = applyRecipeStrategyPatch(plan.recipeId, {
                    forcedBuildingId: nextBuildingId,
                  });
                  if (accepted) {
                    setRecipePreferredBuilding(plan.recipeId, nextBuildingId);
                  }
                }}
              >
                <RecipePlanToggleButton
                  value=""
                  ariaLabel={`${plan.recipeName} ${bundle.common.auto}`}
                  title={bundle.common.auto}
                  testId="recipe-plan-building-toggle-auto"
                >
                  <AutoOptionGlyph />
                </RecipePlanToggleButton>
                {buildingChoices.map(building => (
                  <RecipePlanToggleButton
                    key={building.buildingId}
                    value={building.buildingId}
                    ariaLabel={`${plan.recipeName} ${building.name}`}
                    title={building.name}
                    iconOnly
                    testId={`recipe-plan-building-toggle-${building.buildingId}`}
                  >
                    <EntityIcon
                      label={building.name}
                      iconKey={building.icon}
                      atlasIds={iconAtlasIds}
                      size={22}
                    />
                  </RecipePlanToggleButton>
                ))}
              </RecipePlanToggleGroup>

              {modeChoices.length > 0 && (
              <RecipePlanToggleGroup
                ariaLabel={`${plan.recipeName} ${PROLIFERATOR_MODE_CONTROL_LABEL}`}
                value={selectedMode}
                testId="recipe-plan-mode-toggle-group"
                onChange={nextValue => {
                  const nextMode = nextValue as '' | ProliferatorMode;
                  const nextLevel =
                    nextMode === 'none'
                      ? 0
                      : nextMode
                        ? typeof selectedLevelValue === 'number' && selectedLevelValue > 0
                          ? selectedLevelValue
                          : ''
                        : '';
                  const accepted = applyRecipeStrategyPatch(plan.recipeId, {
                    forcedProliferatorMode: nextMode,
                    forcedProliferatorLevel: nextLevel,
                  });
                  if (accepted) {
                    setRecipePreferredProliferator(plan.recipeId, nextMode, nextLevel);
                  }
                }}
              >
                <RecipePlanToggleButton
                  value=""
                  ariaLabel={`${plan.recipeName} ${bundle.common.auto}`}
                  title={bundle.common.auto}
                  testId="recipe-plan-mode-toggle-auto"
                >
                  <AutoOptionGlyph />
                </RecipePlanToggleButton>
                {modeChoices.map(mode => (
                  <RecipePlanToggleButton
                    key={mode}
                    value={mode}
                    ariaLabel={`${plan.recipeName} ${formatProliferatorMode(mode, locale)}`}
                    title={formatProliferatorMode(mode, locale)}
                    testId={`recipe-plan-mode-toggle-${mode}`}
                  >
                    {mode === 'none' ? NONE_OPTION_LABEL : formatProliferatorMode(mode, locale)}
                  </RecipePlanToggleButton>
                ))}
              </RecipePlanToggleGroup>
              )}

              {modeChoices.length > 0 && !levelSelectDisabled && (
              <RecipePlanToggleGroup
                ariaLabel={`${plan.recipeName} ${PROLIFERATOR_LEVEL_CONTROL_LABEL}`}
                value={selectedLevel}
                testId="recipe-plan-level-toggle-group"
                onChange={nextValue => {
                  const nextLevel = nextValue ? Number(nextValue) : '';
                  const accepted = applyRecipeStrategyPatch(plan.recipeId, {
                    forcedProliferatorLevel: nextLevel,
                  });
                  if (accepted) {
                    setRecipePreferredProliferator(plan.recipeId, selectedMode, nextLevel);
                  }
                }}
              >
                <RecipePlanToggleButton
                  value=""
                  ariaLabel={`${plan.recipeName} ${bundle.common.auto}`}
                  title={bundle.common.auto}
                  testId="recipe-plan-level-toggle-auto"
                >
                  <AutoOptionGlyph />
                </RecipePlanToggleButton>
                {levelChoices.map(level => (
                  <RecipePlanToggleButton
                    key={level}
                    value={String(level)}
                    ariaLabel={`${plan.recipeName} ${bundle.solveRequest.levelPrefix} ${level}`}
                    title={`${bundle.solveRequest.levelPrefix} ${level}`}
                    testId={`recipe-plan-level-toggle-${level}`}
                  >
                    {level}
                  </RecipePlanToggleButton>
                ))}
              </RecipePlanToggleGroup>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              flex: '0 0 auto',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
              gap: 1,
              flexWrap: 'wrap',
              color: 'text.secondary',
            }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <EntityIcon
                label={plan.buildingName}
                iconKey={plan.buildingIconKey}
                atlasIds={iconAtlasIds}
                size={18}
              />
              <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                {displayModel.buildingCountLabel}
              </Typography>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375 }}>
              <BoltRoundedIcon sx={{ fontSize: 16 }} />
              <Typography variant="caption" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {displayModel.powerLabel}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.625,
            flexWrap: 'wrap',
            borderRadius: '16px',
            px: 1.25,
            py: 0.875,
            backgroundColor: 'rgba(22, 54, 89, 0.035)',
          }}
        >
          <Box
            sx={{
              flex: '1 1 320px',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.625,
              flexWrap: 'wrap',
            }}
          >
            <RecipePlanFlowSequence
              items={displayModel.visibleInputs}
              locale={locale}
              atlasIds={iconAtlasIds}
              noneText={bundle.common.none}
            />
            <EastRoundedIcon sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
            <RecipePlanFlowSequence
              items={displayModel.outputs}
              locale={locale}
              atlasIds={iconAtlasIds}
              noneText={bundle.common.none}
            />
            <RecipePlanAuxiliaryInput
              item={displayModel.auxiliaryProliferatorInput}
              locale={locale}
              atlasIds={iconAtlasIds}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              flex: '0 0 auto',
              ml: 'auto',
              color: 'text.secondary',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {displayModel.proliferatorLabel}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
});

export default RecipePlanCard;
