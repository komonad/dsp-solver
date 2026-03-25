import type { LocaleBundle } from '../../../i18n';
import type { WorkbenchSnapshotSectionId } from '../../workbench/snapshotSections';

export type SnapshotSectionId = WorkbenchSnapshotSectionId;
export type SnapshotMetricId = 'objective' | 'balance' | 'spray' | 'status';

export function getSnapshotSectionDescription(
  bundle: LocaleBundle
): Record<SnapshotSectionId, string> {
  return bundle.snapshot.sectionDescription;
}

export function getSnapshotMetricDescription(
  bundle: LocaleBundle
): Record<SnapshotMetricId, string> {
  return bundle.snapshot.metricDescription;
}
