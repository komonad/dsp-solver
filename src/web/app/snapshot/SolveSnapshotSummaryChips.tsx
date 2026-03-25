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
import { getSnapshotMetricDescription } from './solveSnapshotMetadata';
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
  descriptions: Record<SnapshotMetricId, string>,
  color?: 'default' | 'success'
) {
  return (
    <Tooltip
      key={metricId}
      title={descriptions[metricId]}
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
  const metricDescriptions = getSnapshotMetricDescription(bundle);
  return (
    <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
      {renderMetricChip(
        'objective',
        `${bundle.summary.objectiveLabel}: ${formatSolveObjective(objective, locale)}`,
        metricDescriptions
      )}
      {renderMetricChip(
        'balance',
        `${bundle.summary.balanceLabel}: ${formatBalancePolicy(balancePolicy, locale)}`,
        metricDescriptions
      )}
      {renderMetricChip(
        'spray',
        `${bundle.summary.sprayLabel}: ${sprayLabel || bundle.common.notSet}`,
        metricDescriptions
      )}
      {renderMetricChip(
        'status',
        `${bundle.summary.statusLabel}: ${formatSolveStatus(status, locale)}`,
        metricDescriptions,
        status === 'optimal' ? 'success' : 'default'
      )}
    </Stack>
  );
}
