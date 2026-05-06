export type WorkbenchSnapshotSectionId =
  | 'targets'
  | 'rawInputs'
  | 'allowedRecipes'
  | 'disabledRecipes'
  | 'proliferatorPreferences'
  | 'disabledBuildings'
  | 'preferredBuildings'
  | 'buildingParameters'
  | 'dataset';

export type WorkbenchSnapshotSectionState = Record<WorkbenchSnapshotSectionId, boolean>;

export const DEFAULT_WORKBENCH_SNAPSHOT_SECTION_STATE: WorkbenchSnapshotSectionState = {
  targets: true,
  rawInputs: true,
  allowedRecipes: true,
  disabledRecipes: true,
  proliferatorPreferences: true,
  disabledBuildings: true,
  preferredBuildings: true,
  buildingParameters: false,
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
