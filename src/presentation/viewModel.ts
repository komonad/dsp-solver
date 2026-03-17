import type { SolveResult } from '../solver';

export interface PresentationModel {
  status: SolveResult['status'];
  diagnostics: SolveResult['diagnostics'];
  targets: SolveResult['targets'];
  recipePlans: SolveResult['recipePlans'];
  buildingSummary: SolveResult['buildingSummary'];
  powerSummary: SolveResult['powerSummary'];
  externalInputs: SolveResult['externalInputs'];
  surplusOutputs: SolveResult['surplusOutputs'];
  itemBalance: SolveResult['itemBalance'];
}

export function buildPresentationModel(result: SolveResult): PresentationModel {
  return {
    status: result.status,
    diagnostics: result.diagnostics,
    targets: result.targets,
    recipePlans: result.recipePlans,
    buildingSummary: result.buildingSummary,
    powerSummary: result.powerSummary,
    externalInputs: result.externalInputs,
    surplusOutputs: result.surplusOutputs,
    itemBalance: result.itemBalance,
  };
}
