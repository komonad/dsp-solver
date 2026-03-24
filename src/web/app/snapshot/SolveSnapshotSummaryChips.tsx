import { Chip, Stack, Tooltip } from '@mui/material';
import {
  formatBalancePolicy,
  formatSolveObjective,
  formatSolveStatus,
  type AppLocale,
  type LocaleBundle,
} from '../../../i18n';
import type { PresentationModel } from '../../../presentation';
import type { BalancePolicy, SolveObjective, SolveStatus } from '../../../solver';
import type { SnapshotMetricId } from './solveSnapshotMetadata';
import { SNAPSHOT_METRIC_DESCRIPTION } from './solveSnapshotMetadata';
import { snapshotFormalTooltipSlotProps } from '../workbenchStyles';

export interface SolveSnapshotSummaryChipsProps {
  bundle: LocaleBundle;
  locale: AppLocale;
  requestSummary?: PresentationModel['requestSummary'];
  objective: SolveObjective;
  balancePolicy: BalancePolicy;
  sprayLabel: string;
  status: SolveStatus | null;
}

function renderMetricChip(
  metricId: SnapshotMetricId,
  label: string,
  color?: 'default' | 'success'
) {
  return (
    <Tooltip
      key={metricId}
      title={SNAPSHOT_METRIC_DESCRIPTION[metricId]}
      slotProps={snapshotFormalTooltipSlotProps}
    >
      <Chip size="small" variant="outlined" color={color} label={label} />
    </Tooltip>
  );
}

export default function SolveSnapshotSummaryChips({
  bundle,
  locale,
  requestSummary,
  objective,
  balancePolicy,
  sprayLabel,
  status,
}: SolveSnapshotSummaryChipsProps) {
  return (
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
      {requestSummary?.solverVersion ? (
        <Chip
          size="small"
          variant="outlined"
          label={`${bundle.summary.solverVersionLabel}: ${requestSummary.solverVersion}`}
        />
      ) : null}
      {renderMetricChip(
        'objective',
        `${bundle.summary.objectiveLabel}: ${formatSolveObjective(objective, locale)}`
      )}
      {renderMetricChip(
        'balance',
        `${bundle.summary.balanceLabel}: ${formatBalancePolicy(balancePolicy, locale)}`
      )}
      {renderMetricChip(
        'spray',
        `${bundle.summary.sprayLabel}: ${sprayLabel || bundle.common.notSet}`
      )}
      {renderMetricChip(
        'status',
        `${bundle.summary.statusLabel}: ${formatSolveStatus(status, locale)}`,
        status === 'optimal' ? 'success' : 'default'
      )}
    </Stack>
  );
}
