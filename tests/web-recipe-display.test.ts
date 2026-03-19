import { resolveCatalogModel } from '../src/catalog';
import type { PresentationRecipePlan } from '../src/presentation';
import { buildRecipeFlowDisplay } from '../src/web/shared/recipeDisplay';

describe('buildRecipeFlowDisplay', () => {
  const catalog = resolveCatalogModel({
    items: [
      { ID: 1, Type: 0, Name: 'Ore', IconName: 'ore' },
      { ID: 2, Type: 0, Name: 'Plate', IconName: 'plate' },
      { ID: 1143, Type: 0, Name: 'Proliferator Mk.III', IconName: 'spray3' },
      { ID: 2303, Type: 0, Name: 'Assembler', IconName: 'assembler', Speed: 1, WorkEnergyPerTick: 1 },
    ],
    recipes: [],
  }, {
    proliferatorLevels: [
      { Level: 0, SpeedMultiplier: 1, ProductivityMultiplier: 1, PowerMultiplier: 1 },
      {
        Level: 3,
        ItemID: 1143,
        SprayCount: 75,
        SpeedMultiplier: 2,
        ProductivityMultiplier: 1.25,
        PowerMultiplier: 2.5,
      },
    ],
    buildingRules: [{ ID: 2303, Category: 'factory' }],
  });

  function makePlan(): PresentationRecipePlan {
    return {
      recipeId: 'r1',
      recipeName: 'Ore to Plate',
      recipeIconKey: 'recipe',
      buildingId: '2303',
      buildingName: 'Assembler',
      buildingIconKey: 'assembler',
      proliferatorLevel: 3,
      proliferatorMode: 'productivity',
      proliferatorLabel: '增产 等级 3',
      runsPerMin: 60,
      exactBuildingCount: 1,
      roundedUpBuildingCount: 1,
      activePowerMW: 1,
      roundedPlacementPowerMW: 1,
      inputs: [
        { itemId: '1', itemName: 'Ore', iconKey: 'ore', ratePerMin: 60 },
        { itemId: '1143', itemName: 'Proliferator Mk.III', iconKey: 'spray3', ratePerMin: 0.8 },
      ],
      outputs: [{ itemId: '2', itemName: 'Plate', iconKey: 'plate', ratePerMin: 75 }],
    };
  }

  it('moves the spray consumable out of the visible input list', () => {
    const display = buildRecipeFlowDisplay(catalog, makePlan());
    expect(display.visibleInputs.map(item => item.itemId)).toEqual(['1']);
    expect(display.auxiliaryProliferatorInput?.itemId).toBe('1143');
  });

  it('keeps the full input list when the plan has no proliferator mode', () => {
    const plan = makePlan();
    plan.proliferatorMode = 'none';
    plan.proliferatorLevel = 0;

    const display = buildRecipeFlowDisplay(catalog, plan);
    expect(display.visibleInputs.map(item => item.itemId)).toEqual(['1', '1143']);
    expect(display.auxiliaryProliferatorInput).toBeNull();
  });
});
