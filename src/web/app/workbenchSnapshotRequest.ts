import type { ResolvedCatalogModel } from '../../catalog';
import type { SolveRequest } from '../../solver';
import {
  buildForcedRecipeStrategyOverrides,
  buildGlobalProliferatorOverrides,
  buildPreferredBuildingOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  type AdvancedSolveOverrides,
} from '../workbench/requestBuilder';
import type { WorkbenchEditorState } from '../workbench/persistence';

export function buildWorkbenchSnapshotSolveRequest(params: {
  catalog: ResolvedCatalogModel;
  editorState: WorkbenchEditorState;
  advancedOverrides?: AdvancedSolveOverrides;
}): SolveRequest {
  const { catalog, editorState, advancedOverrides } = params;
  const uiOverrides = mergeAdvancedSolveOverrides(
    mergeAdvancedSolveOverrides(
      mergeAdvancedSolveOverrides(
        {
          disabledRecipeIds: editorState.disabledRecipeIds,
          disabledBuildingIds: editorState.disabledBuildingIds,
          allowedRecipesByItem: editorState.allowedRecipesByItem,
        },
        buildPreferredBuildingOverrides(catalog, editorState.preferredBuildings)
      ),
      buildPreferredRecipeOverrides(editorState.recipePreferences)
    ),
    mergeAdvancedSolveOverrides(
      buildGlobalProliferatorOverrides(
        editorState.proliferatorPolicy,
        editorState.globalProliferatorLevel
      ),
      buildForcedRecipeStrategyOverrides(editorState.recipeStrategyOverrides)
    )
  );

  return buildWorkbenchRequest({
    targets: editorState.targets,
    objective: editorState.objective,
    balancePolicy: editorState.balancePolicy,
    autoPromoteUnavailableItemsToRawInputs:
      editorState.autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds: editorState.rawInputItemIds,
    disabledRawInputItemIds: editorState.disabledRawInputItemIds,
    advancedOverrides: mergeAdvancedSolveOverrides(advancedOverrides, uiOverrides),
  });
}
