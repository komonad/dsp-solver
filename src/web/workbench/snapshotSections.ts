export type WorkbenchSnapshotSectionId =
  | 'targets'
  | 'allowedRecipes'
  | 'disabledRecipes'
  | 'proliferatorPreferences'
  | 'disabledBuildings'
  | 'preferredBuildings'
  | 'dataset';

export type WorkbenchSnapshotSectionState = Record<WorkbenchSnapshotSectionId, boolean>;

export const DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE: WorkbenchSnapshotSectionState = {
  targets: true,
  allowedRecipes: true,
  disabledRecipes: true,
  proliferatorPreferences: true,
  disabledBuildings: true,
  preferredBuildings: true,
  dataset: false,
};

export function resolveWorkbenchSnapshotSectionState(
  state: Partial<WorkbenchSnapshotSectionState> | null | undefined
): WorkbenchSnapshotSectionState {
  return {
    ...DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE,
    ...(state ?? {}),
  };
}
