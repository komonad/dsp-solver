import { readFileSync } from 'fs';
import { join } from 'path';
import {
  parseJsonText,
  resolveCatalogModel,
  type CatalogDefaultConfigSpec,
  type VanillaDatasetSpec,
} from '../src/catalog';
import { solveCatalogRequest } from '../src/solver';

function loadOrbitalRing() {
  const datasetText = readFileSync(join(__dirname, '..', 'data', 'OrbitalRing.json'), 'utf8');
  const defaultsText = readFileSync(
    join(__dirname, '..', 'data', 'OrbitalRing.defaults.json'),
    'utf8'
  );
  const dataset = parseJsonText<VanillaDatasetSpec>(datasetText);
  const catalog = resolveCatalogModel(dataset, parseJsonText<CatalogDefaultConfigSpec>(defaultsText));
  const itemNames = new Map<string, string>();
  for (const item of dataset.items) {
    itemNames.set(String(item.ID), item.Name);
  }
  const recipeNames = new Map<string, string>();
  for (const r of dataset.recipes) {
    recipeNames.set(String(r.ID), r.Name);
  }
  return { dataset, catalog, itemNames, recipeNames };
}

test.skip('debug: solar sail case', () => {
  const { catalog, itemNames, recipeNames } = loadOrbitalRing();
  const result = solveCatalogRequest(catalog, {
    targets: [{ itemId: '6003', ratePerMin: 120 }],
    objective: 'min_power',
    balancePolicy: 'allow_surplus',
    autoPromoteUnavailableItemsToRawInputs: true,
    rawInputItemIds: ['1143', '1000', '1007'],
    disabledRawInputItemIds: ['7015', '7101'],
    disabledRecipeIds: ['510', '704', '705'],
    disabledBuildingIds: ['6215', '2319'],
    allowedRecipesByItem: {
      '1030': ['777'],
      '1114': ['701', '16'],
      '7022': ['849'],
      '7708': ['506'],
    },
    globalForcedProliferatorLevel: 0,
    globalForcedProliferatorMode: 'none',
  });

  console.log('\n=== RESULT ===');
  console.log('Status:', result.status);
  console.log(`Surplus (${result.surplusOutputs.length} types):`);
  for (const s of result.surplusOutputs) {
    console.log(`  ${itemNames.get(s.itemId) ?? s.itemId} (${s.itemId}): ${s.ratePerMin.toFixed(4)}/min`);
  }
  console.log(`Recipes (${result.recipePlans.length}):`);
  for (const plan of result.recipePlans) {
    console.log(`  ${recipeNames.get(plan.recipeId) ?? plan.recipeId} (${plan.recipeId}): ${plan.runsPerMin.toFixed(4)} runs/min`);
  }
  console.log('Power:', result.powerSummary.activePowerMW.toFixed(4), 'MW');

  const audit = result.solveAudit;
  console.log('\n--- AUDIT ---');
  console.log('Termination:', audit?.surplusReweightTermination ?? 'none');
  for (const a of audit?.attempts ?? []) {
    console.log(`  ${a.phase} r=${a.round ?? '-'} status=${a.status} types=${a.surplusItemCount} rate=${(a.surplusRatePerMin ?? 0).toFixed(2)} primary=${(a.primaryObjectiveValue ?? 0).toFixed(4)} isBest=${a.isBestCandidate ?? '-'} vars=${a.variableCount} constrs=${a.constraintCount} binaries=${a.binaryCount ?? '-'} solveMs=${a.solveDurationMs?.toFixed(0)}`);
  }

  // Log the recipes used
  for (const plan of result.recipePlans) {
    console.log(`  recipe ${recipeNames.get(plan.recipeId) ?? plan.recipeId} (${plan.recipeId})`);
  }
});
