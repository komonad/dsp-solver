/**
 * Generate recipeRules for OrbitalRing.defaults.json based on proliferator policy:
 * - If a recipe has the same item with the same count in both input and output → speed only (code 1)
 * - Otherwise → full proliferator support (code 3)
 *
 * Recipes that already have Proliferator != 0 in the dataset are skipped.
 * Existing recipeRules with ModifierCodeOverride are preserved.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

const dataset = JSON.parse(readFileSync(join(dataDir, 'OrbitalRing.json'), 'utf8'));
const defaults = JSON.parse(readFileSync(join(dataDir, 'OrbitalRing.defaults.json'), 'utf8'));

function hasMatchingInputOutput(recipe) {
  for (let i = 0; i < recipe.Items.length; i++) {
    for (let j = 0; j < recipe.Results.length; j++) {
      if (recipe.Items[i] === recipe.Results[j] && recipe.ItemCounts[i] === recipe.ResultCounts[j]) {
        return true;
      }
    }
  }
  return false;
}

// Collect existing recipeRules keyed by ID (preserve non-proliferator overrides)
const existingRules = new Map();
for (const rule of defaults.recipeRules ?? []) {
  existingRules.set(rule.ID, rule);
}

// Preserve existing speedOnlyRecipeIds (manually curated entries)
const existingSpeedOnlyIds = new Set(defaults.recipeModifierPolicy?.speedOnlyRecipeIds ?? []);

const speedOnlyIds = [];
const fullProliferatorIds = [];

for (const recipe of dataset.recipes) {
  // Skip recipes that already have proliferator support in the dataset
  if (recipe.Proliferator !== 0) {
    continue;
  }

  // Skip recipes already covered by explicit recipeRules
  if (existingRules.has(recipe.ID) && existingRules.get(recipe.ID).ModifierCodeOverride !== undefined) {
    continue;
  }

  if (hasMatchingInputOutput(recipe) || existingSpeedOnlyIds.has(recipe.ID)) {
    speedOnlyIds.push(recipe.ID);
  } else {
    fullProliferatorIds.push(recipe.ID);
  }
}

speedOnlyIds.sort((a, b) => a - b);
fullProliferatorIds.sort((a, b) => a - b);

console.log(`Speed-only recipes (code 1): ${speedOnlyIds.length}`);
for (const id of speedOnlyIds) {
  const recipe = dataset.recipes.find(r => r.ID === id);
  console.log(`  ${id}: ${recipe.Name}`);
}

console.log(`\nFull proliferator recipes (code 3): ${fullProliferatorIds.length}`);
for (const id of fullProliferatorIds) {
  const recipe = dataset.recipes.find(r => r.ID === id);
  console.log(`  ${id}: ${recipe.Name}`);
}

// Update defaults: set speedOnlyRecipeIds and add ModifierCodeOverride: 3 to recipeRules
defaults.recipeModifierPolicy = defaults.recipeModifierPolicy ?? {};
defaults.recipeModifierPolicy.speedOnlyRecipeIds = speedOnlyIds;
// Remove speedOnlyWhenInputOutputCountsMatch since we're being explicit now
delete defaults.recipeModifierPolicy.speedOnlyWhenInputOutputCountsMatch;

// Merge full-proliferator recipes into recipeRules
for (const id of fullProliferatorIds) {
  if (existingRules.has(id)) {
    existingRules.get(id).ModifierCodeOverride = 3;
  } else {
    existingRules.set(id, { ID: id, ModifierCodeOverride: 3 });
  }
}

// Sort recipeRules by ID
defaults.recipeRules = Array.from(existingRules.values()).sort((a, b) => a.ID - b.ID);

writeFileSync(join(dataDir, 'OrbitalRing.defaults.json'), JSON.stringify(defaults, null, 2) + '\n');
console.log('\nUpdated OrbitalRing.defaults.json');
