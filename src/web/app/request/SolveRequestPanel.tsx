import React from 'react';
import {
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import type { BalancePolicy, SolveObjective } from '../../../solver';
import type { WorkbenchProliferatorPolicy } from '../../workbench/requestBuilder';
import ItemGridPicker from '../../shared/ItemGridPicker';
import { pickDefaultGlobalProliferatorLevel } from '../workbenchHelpers';
import {
  cardStyle,
  collapsibleSectionStyle,
  compactSelectFieldSx,
  inputStyle,
  inlineConstraintSectionGroupSx,
  summaryStyle,
} from '../workbenchStyles';
import { useWorkbench } from '../WorkbenchContext';
import AllowedRecipesSection from './AllowedRecipesSection';
import DisabledBuildingsSection from './DisabledBuildingsSection';
import DisabledRecipesSection from './DisabledRecipesSection';
import PreferredBuildingsSection from './PreferredBuildingsSection';

export default function SolveRequestPanel() {
  const {
    bundle,
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
    advancedOverridesText,
    parsedOverrides,
    setTargetPickerQuery,
    setTargetDraftItemId,
    setTargetDraftRatePerMin,
    setObjective,
    setBalancePolicy,
    setProliferatorPolicy,
    setGlobalProliferatorLevel,
    setAdvancedOverridesText,
    addTarget,
  } = useWorkbench();

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 14 }}>
      <Typography variant="h6">{bundle.solveRequest.title}</Typography>
      <div style={{ display: 'grid', gap: 16 }}>
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
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr) 88px',
                  lg: 'minmax(0, 1fr) 88px auto',
                },
                alignItems: 'end',
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
                onChange={event => setTargetDraftRatePerMin(Number(event.target.value) || 0)}
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
                sx={{
                  minHeight: 40,
                  px: 1.5,
                  gridColumn: { xs: '1 / -1', lg: 'auto' },
                  justifySelf: 'start',
                  whiteSpace: 'nowrap',
                }}
              >
                {bundle.solveRequest.addTarget}
              </Button>
            </Box>
          </Box>
        </div>

        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
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
        </Box>

        <Box sx={inlineConstraintSectionGroupSx}>
          <DisabledRecipesSection />
          <DisabledBuildingsSection />
        </Box>

        <AllowedRecipesSection />

        <PreferredBuildingsSection />

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
