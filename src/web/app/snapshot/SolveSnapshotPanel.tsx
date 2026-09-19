import SnapshotPreferences from './SnapshotPreferences';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Divider, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import type { SolveObjective } from '../../../solver';
import type { WorkbenchProliferatorPolicy } from '../../workbench/requestBuilder';
import { EntityIcon } from '../../shared/EntityIcon';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';
import CopySolveRequestJsonButton from './CopySolveRequestJsonButton';
import SnapshotRemoveButton from './SnapshotRemoveButton';
import SolveSnapshotSummaryChips from './SolveSnapshotSummaryChips';
import { isPowerItem, pickDefaultGlobalProliferatorLevel } from '../workbenchHelpers';
import {
  cardStyle,
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
    updateTarget,
    removeTarget,
    unmarkItemAsRawInput,
    loadedSource,
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
    <article style={{ ...cardStyle, display: 'grid', gap: 18 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TuneRoundedIcon sx={{ fontSize: 19, color: 'primary.main' }} />
          <Typography component="h2" variant="h6" sx={{ fontSize: 16 }}>{bundle.summary.solveSnapshotTitle}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} size="small" onClick={startSolve} disabled={!canStartSolve} sx={{ minHeight: 30, px: 1.25, fontSize: 12 }}>
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 0.75, rowGap: 1.5, pt: 0.5 }}>
        <TextField
          select
          size="small"
          sx={{ ...snapshotSelectFieldSx, flex: '1 1 96px', minWidth: 96 }}
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
          sx={{ ...snapshotSelectFieldSx, flex: '1 1 130px', minWidth: 130 }}
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
            sx={{ ...snapshotSelectFieldSx, flex: '1 1 88px', minWidth: 88 }}
            label={bundle.solveRequest.preferredSprayLevelLabel}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
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

          <SnapshotPreferences sectionState={sectionState} setSectionExpanded={setSectionExpanded}
            addingSectionId={addingSectionId} toggleAddingSection={toggleAddingSection} />


        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {emptySnapshotMessage}
        </Typography>
      )}
    </article>
  );
}
