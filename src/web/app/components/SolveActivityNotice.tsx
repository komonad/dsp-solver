import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { buildSolveActivityViewModel } from '../../workbench/solveActivity';

export interface SolveActivityNoticeProps {
  compact?: boolean;
}

export default function SolveActivityNotice(props: SolveActivityNoticeProps) {
  const { compact = false } = props;
  const { bundle, locale } = useCatalog();
  const { autoSolveState, canCancelSolve, cancelSolve, startSolve } = useSolve();
  const [nowEpochMs, setNowEpochMs] = useState(() => Date.now());
  const isSolveRunning = autoSolveState.activity.status === 'running';
  const isSolveCancelled = autoSolveState.activity.status === 'cancelled';

  useEffect(() => {
    if (!isSolveRunning) {
      return undefined;
    }

    setNowEpochMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowEpochMs(Date.now());
    }, 250);
    return () => window.clearInterval(intervalId);
  }, [autoSolveState.activity.startedAtEpochMs, isSolveRunning]);

  const activity = useMemo(
    () =>
      buildSolveActivityViewModel({
        bundle,
        locale,
        solveState: autoSolveState,
        nowEpochMs,
      }),
    [autoSolveState, bundle, locale, nowEpochMs]
  );

  if (!activity) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: compact ? 1 : 1.25,
        p: compact ? 1.25 : 1.5,
        borderRadius: compact ? '14px' : '16px',
        border: activity.tone === 'warning'
          ? '1px solid rgba(191, 111, 34, 0.22)'
          : '1px solid rgba(24, 88, 163, 0.18)',
        background: activity.tone === 'warning'
          ? 'linear-gradient(135deg, rgba(255, 242, 222, 0.92), rgba(255, 252, 247, 0.92))'
          : 'linear-gradient(135deg, rgba(232, 243, 255, 0.92), rgba(248, 251, 255, 0.94))',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: compact ? 1 : 1.25,
        }}
      >
        {isSolveCancelled ? (
          <Chip
            size="small"
            color="warning"
            label={bundle.solveRequest.cancelSolveButton}
            sx={{ mt: compact ? 0.125 : 0.25, flexShrink: 0 }}
          />
        ) : (
          <CircularProgress
            size={compact ? 18 : 20}
            thickness={5}
            color={activity.tone}
            sx={{ mt: compact ? 0.125 : 0.25, flexShrink: 0 }}
          />
        )}
        <Box sx={{ minWidth: 0, flex: '1 1 auto', display: 'grid', gap: 0.375 }}>
          <Typography
            variant={compact ? 'body2' : 'body1'}
            sx={{ fontWeight: 700, lineHeight: 1.35 }}
          >
            {activity.title}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(24, 51, 89, 0.74)', lineHeight: 1.55 }}
          >
            {activity.description}
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
        <Chip size="small" color={activity.tone} label={activity.chipLabel} />
        <Chip size="small" variant="outlined" label={activity.stageLabel} />
        <Chip size="small" variant="outlined" label={activity.elapsedLabel} />
        <Chip size="small" variant="outlined" label={activity.resultBadgeLabel} />
      </Stack>

      <Box sx={{ display: 'grid', gap: 0.75 }}>
        {isSolveCancelled ? (
          <Box
            sx={{
              height: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(191, 111, 34, 0.18)',
            }}
          />
        ) : (
          <LinearProgress
            color={activity.tone}
            sx={{
              height: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(24, 51, 89, 0.08)',
            }}
          />
        )}
        <Typography variant="caption" sx={{ color: 'rgba(24, 51, 89, 0.7)', lineHeight: 1.5 }}>
          {activity.stageDescription}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(24, 51, 89, 0.62)' }}>
          {activity.engineLabel}
        </Typography>
      </Box>

      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
        {isSolveRunning ? (
          <Button variant="contained" size="small" color="warning" onClick={cancelSolve} disabled={!canCancelSolve}>
            {bundle.solveRequest.cancelSolveButton}
          </Button>
        ) : null}
        {isSolveCancelled ? (
          <Button variant="outlined" size="small" onClick={startSolve}>
            {bundle.solveRequest.restartSolveButton}
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
