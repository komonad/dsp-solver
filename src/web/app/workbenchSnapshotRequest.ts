import type { ResolvedCatalogModel } from '../../catalog';
import type { BuildingParameterOverride, SolveRequest } from '../../solver';
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

const DEFAULT_LAB_STACK_LAYERS = 15;

function buildBuildingOverridesFromEditorState(
  catalog: ResolvedCatalogModel,
  editorState: WorkbenchEditorState
): Record<string, BuildingParameterOverride> | undefined {
  const labStackLayers = editorState.labStackLayers ?? DEFAULT_LAB_STACK_LAYERS;
  const beltSpeed = editorState.beltSpeedItemsPerMin;
  if (labStackLayers <= 1 && !beltSpeed) {
    return undefined;
  }

  const overrides: Record<string, BuildingParameterOverride> = {};
  for (const building of catalog.buildings) {
    if (labStackLayers && labStackLayers > 1 && building.category === 'lab') {
      overrides[building.buildingId] = {
        ...(overrides[building.buildingId] ?? {}),
        stackLayers: labStackLayers,
      };
    }
    if (beltSpeed && beltSpeed > 0 && building.fractionatorBeltSpeedItemsPerMin) {
      overrides[building.buildingId] = {
        ...(overrides[building.buildingId] ?? {}),
        beltSpeedItemsPerMin: beltSpeed,
      };
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

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

  const request = buildWorkbenchRequest({
    targets: editorState.targets,
    objective: editorState.objective,
    balancePolicy: editorState.balancePolicy,
    autoPromoteUnavailableItemsToRawInputs:
      editorState.autoPromoteUnavailableItemsToRawInputs,
    rawInputItemIds: editorState.rawInputItemIds,
    disabledRawInputItemIds: editorState.disabledRawInputItemIds,
    advancedOverrides: mergeAdvancedSolveOverrides(advancedOverrides, uiOverrides),
  });

  const buildingOverrides = buildBuildingOverridesFromEditorState(catalog, editorState);
  if (buildingOverrides) {
    request.buildingOverrides = {
      ...buildingOverrides,
      ...(request.buildingOverrides ?? {}),
    };
  }

  return request;
}
