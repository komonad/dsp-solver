import React from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Alert,
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  formatBalancePolicy,
  formatPower,
  formatRate,
  formatSolveObjective,
  formatSolveStatus,
} from '../../i18n';
import { EntityLabel } from '../shared/EntityIcon';
import { ClickableItemLabel } from './ClickableItemLabel';
import { RecipeIoSequence } from './FlowRateDisplay';
import { SelectOption } from './SelectOption';
import { formatRecipeCycleTime } from './workbenchHelpers';
import { cardStyle, compactSelectFieldSx, sectionHeadingStyle } from './workbenchStyles';
import { useWorkbench } from './WorkbenchContext';

// ---------------------------------------------------------------------------
// SolveSnapshotPanel
// ---------------------------------------------------------------------------

export default function SolveSnapshotPanel() {
  const {
    bundle,
    locale,
    catalog,
    model,
    iconAtlasIds,
    targets,
    objective,
    balancePolicy,
    hasTargets,
    requestSummary,
    solveError,
    updateTarget,
    removeTarget,
    clearAllowedRecipesForItem,
  } = useWorkbench();

  return (
    <article style={{ ...cardStyle, display: 'grid', gap: 12 }}>
      <Typography variant="h6">{bundle.summary.solveSnapshotTitle}</Typography>
      {solveError && hasTargets ? <Alert severity="error">{solveError}</Alert> : null}
      {requestSummary ? (
        <>
          {/* Solver info chips */}
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
              label={`${bundle.summary.objectiveLabel}: ${formatSolveObjective(
                objective,
                locale
              )}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${bundle.summary.balanceLabel}: ${formatBalancePolicy(
                balancePolicy,
                locale
              )}`}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`${bundle.summary.sprayLabel}: ${
                requestSummary.proliferatorPolicyLabel ?? bundle.common.notSet
              }`}
            />
            <Chip
              size="small"
              variant="outlined"
              color={model?.status === 'optimal' ? 'success' : 'default'}
              label={`${bundle.summary.statusLabel}: ${formatSolveStatus(
                model?.status ?? null,
                locale
              )}`}
            />
          </Stack>

          <Divider />

          {/* Editable target list */}
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
                <Box
                  key={`${target.itemId}:${index}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 84px auto',
                    gap: 0.75,
                    alignItems: 'center',
                    justifyContent: 'start',
                  }}
                >
                  <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center' }}>
                    <ClickableItemLabel
                      itemId={target.itemId}
                      itemName={target.itemName}
                      iconKey={target.iconKey}
                      iconOnly
                      iconSize={22}
                    />
                  </Box>
                  <TextField
                    type="number"
                    size="small"
                    fullWidth
                    label={bundle.overview.requestLabel}
                    sx={{
                      '& .MuiInputBase-input': { px: 1, py: 0.75, fontSize: 13 },
                      '& .MuiInputLabel-root': { fontSize: 12 },
                    }}
                    value={targets[index]?.ratePerMin ?? target.ratePerMin}
                    inputProps={{ min: 0, step: 1 }}
                    onChange={event =>
                      updateTarget(index, {
                        ratePerMin: Number(event.target.value) || 0,
                      })
                    }
                  />
                  <Tooltip title={bundle.solveRequest.removeTarget}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => removeTarget(index)}
                        disabled={!catalog}
                        sx={{
                          border: '1px solid rgba(24, 51, 89, 0.12)',
                          borderRadius: '10px',
                        }}
                      >
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))
            )}
          </Stack>

          {/* Forced recipes list (allowedRecipeSettings) */}
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              {bundle.summary.forcedRecipesLabel}
            </Typography>
            {requestSummary.allowedRecipeSettings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {bundle.common.none}
              </Typography>
            ) : (
              requestSummary.allowedRecipeSettings.map(setting => (
                <Box
                  key={`${setting.itemId}:${setting.recipeId}`}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 0.75,
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      flexWrap: 'nowrap',
                      overflowX: 'auto',
                      overflowY: 'hidden',
                      px: 0.25,
                      py: 0.4,
                      minHeight: 0,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'inline-grid',
                        gridTemplateColumns: 'auto auto auto',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 0,
                        flex: '0 0 auto',
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0,
                          display: 'flex',
                          justifyContent: 'flex-end',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <RecipeIoSequence items={setting.inputs} />
                      </Box>
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'inline-grid',
                          gridTemplateRows: '10px 10px',
                          justifyItems: 'center',
                          alignItems: 'center',
                          minWidth: 28,
                          flex: '0 0 auto',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            whiteSpace: 'nowrap',
                            fontWeight: 700,
                            color: '#183359',
                            letterSpacing: '0.02em',
                            fontSize: 10,
                            lineHeight: 1,
                          }}
                        >
                          {`${formatRecipeCycleTime(setting.cycleTimeSec, locale)} s`}
                        </Typography>
                        <Box
                          sx={{
                            position: 'relative',
                            width: '100%',
                            minWidth: 24,
                            height: 2,
                            borderRadius: '999px',
                            background:
                              'linear-gradient(90deg, rgba(24, 51, 89, 0.22) 0%, rgba(24, 51, 89, 0.75) 100%)',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              right: -1,
                              top: '50%',
                              width: 8,
                              height: 8,
                              borderTop: '2px solid #183359',
                              borderRight: '2px solid #183359',
                              transform: 'translateY(-50%) rotate(45deg)',
                            }}
                          />
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          minWidth: 0,
                          display: 'flex',
                          justifyContent: 'flex-start',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <RecipeIoSequence items={setting.outputs} />
                      </Box>
                    </Box>
                  </Box>
                  <Tooltip title={bundle.summary.clearForcedRecipeButton}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => clearAllowedRecipesForItem(setting.itemId)}
                        disabled={!catalog}
                        sx={{
                          border: '1px solid rgba(24, 51, 89, 0.12)',
                          borderRadius: '10px',
                        }}
                      >
                        <CloseRoundedIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              ))
            )}
          </Stack>

          {/* Recipe preference settings list */}
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              {bundle.summary.recipePreferencesLabel}
            </Typography>
            {requestSummary.preferredRecipeSettings.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {bundle.common.none}
              </Typography>
            ) : (
              requestSummary.preferredRecipeSettings.map(setting => (
                <Typography key={setting.recipeId} variant="body2">
                  <EntityLabel
                    label={setting.recipeName}
                    iconKey={setting.recipeIconKey}
                    atlasIds={iconAtlasIds}
                    size={18}
                  />
                  {setting.buildingName ? (
                    <>
                      {' '}
                      |{' '}
                      <EntityLabel
                        label={setting.buildingName}
                        iconKey={setting.buildingIconKey}
                        atlasIds={iconAtlasIds}
                        size={18}
                      />
                    </>
                  ) : null}
                  {setting.proliferatorPreferenceLabel
                    ? ` | ${setting.proliferatorPreferenceLabel}`
                    : ''}
                </Typography>
              ))
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
