import { buildFlowGraphData } from '../src/web/app/flowGraph/buildFlowGraphData';
import type { ResolvedCatalogModel } from '../src/catalog';
import type { PresentationModel, PresentationRecipePlan, PresentationItemRate } from '../src/presentation';

function makeItemRate(itemId: string, name: string, rate: number): PresentationItemRate {
  return { itemId, itemName: name, ratePerMin: rate };
}

function makeRecipePlan(overrides: Partial<PresentationRecipePlan> & { inputs: PresentationItemRate[]; outputs: PresentationItemRate[] }): PresentationRecipePlan {
  return {
    recipeId: 'recipe-a',
    recipeName: 'Recipe A',
    buildingId: 'smelter',
    buildingName: 'Smelter',
    proliferatorLevel: 0,
    proliferatorMode: 'none',
    proliferatorLabel: '',
    runsPerMin: 60,
    exactBuildingCount: 1,
    roundedUpBuildingCount: 1,
    activePowerMW: 1,
    roundedPlacementPowerMW: 1,
    ...overrides,
  };
}

function makeModel(overrides: Partial<PresentationModel> = {}): PresentationModel {
  return {
    catalogSummary: {
      iconAtlasIds: ['Vanilla'],
      itemCount: 0,
      recipeCount: 0,
      buildingCount: 0,
      proliferatorLevelCount: 0,
      rawItemCount: 0,
      targetableItemCount: 0,
    },
    status: 'optimal',
    diagnostics: null,
    solvedSummary: null,
    targets: [],
    recipePlans: [],
    buildingSummary: [],
    powerSummary: null,
    externalInputs: [],
    surplusOutputs: [],
    itemBalance: [],
    itemLedgerSections: [],
    itemSlicesById: {},
    ...overrides,
  };
}

describe('buildFlowGraphData', () => {
  it('returns empty for no recipe plans', () => {
    const result = buildFlowGraphData([], null, makeModel());
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });

  it('creates recipe nodes for each plan', () => {
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        recipeId: 'smelt-plate',
        recipeName: 'Smelt Plate',
        buildingName: 'Smelter',
        roundedUpBuildingCount: 3,
        inputs: [makeItemRate('ore', 'Ore', 30)],
        outputs: [makeItemRate('plate', 'Plate', 30)],
      }),
    ];
    const model = makeModel({
      externalInputs: [makeItemRate('ore', 'Ore', 30)],
      targets: [{ itemId: 'plate', itemName: 'Plate', requestedRatePerMin: 30, actualRatePerMin: 30 }],
    });

    const result = buildFlowGraphData(plans, null, model);

    const recipeNodes = result.nodes.filter(n => n.type === 'recipe');
    expect(recipeNodes).toHaveLength(1);
    expect((recipeNodes[0].data as any).buildingName).toBe('Smelter');
    expect((recipeNodes[0].data as any).buildingCount).toBe(3);
  });

  it('creates external input and output nodes', () => {
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        inputs: [makeItemRate('ore', 'Ore', 30)],
        outputs: [makeItemRate('plate', 'Plate', 30)],
      }),
    ];
    const model = makeModel({
      externalInputs: [makeItemRate('ore', 'Ore', 30)],
      targets: [{ itemId: 'plate', itemName: 'Plate', requestedRatePerMin: 30, actualRatePerMin: 30 }],
    });

    const result = buildFlowGraphData(plans, null, model);

    const inputNodes = result.nodes.filter(n => n.id.startsWith('input-'));
    const outputNodes = result.nodes.filter(n => n.id.startsWith('output-'));
    expect(inputNodes).toHaveLength(1);
    expect(outputNodes).toHaveLength(1);
    expect((inputNodes[0].data as any).kind).toBe('input');
    expect((outputNodes[0].data as any).kind).toBe('output');
  });

  it('builds edges between producers and consumers', () => {
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        recipeId: 'smelt',
        recipeName: 'Smelt',
        inputs: [makeItemRate('ore', 'Ore', 60)],
        outputs: [makeItemRate('plate', 'Plate', 60)],
      }),
      makeRecipePlan({
        recipeId: 'assemble',
        recipeName: 'Assemble',
        inputs: [makeItemRate('plate', 'Plate', 60)],
        outputs: [makeItemRate('gear', 'Gear', 30)],
      }),
    ];
    const model = makeModel({
      externalInputs: [makeItemRate('ore', 'Ore', 60)],
      targets: [{ itemId: 'gear', itemName: 'Gear', requestedRatePerMin: 30, actualRatePerMin: 30 }],
    });

    const result = buildFlowGraphData(plans, null, model);

    // Should have edge from recipe-0 (smelt) → recipe-1 (assemble) for plate
    const interRecipeEdges = result.edges.filter(
      e => e.source.startsWith('recipe-') && e.target.startsWith('recipe-')
    );
    expect(interRecipeEdges.length).toBeGreaterThanOrEqual(1);
    const plateEdge = interRecipeEdges.find(e => (e.data as any).itemName === 'Plate');
    expect(plateEdge).toBeTruthy();
  });

  it('assigns varying edge widths based on rates', () => {
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        recipeId: 'r1',
        inputs: [makeItemRate('a', 'A', 1)],
        outputs: [makeItemRate('b', 'B', 1)],
      }),
      makeRecipePlan({
        recipeId: 'r2',
        inputs: [makeItemRate('c', 'C', 1000)],
        outputs: [makeItemRate('d', 'D', 1000)],
      }),
    ];
    const model = makeModel({
      externalInputs: [
        makeItemRate('a', 'A', 1),
        makeItemRate('c', 'C', 1000),
      ],
      targets: [
        { itemId: 'b', itemName: 'B', requestedRatePerMin: 1, actualRatePerMin: 1 },
        { itemId: 'd', itemName: 'D', requestedRatePerMin: 1000, actualRatePerMin: 1000 },
      ],
    });

    const result = buildFlowGraphData(plans, null, model);
    const widths = result.edges.map(e => (e.data as any).width);
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    expect(maxWidth).toBeGreaterThan(minWidth);
  });

  it('handles surplus outputs as output nodes', () => {
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        inputs: [makeItemRate('ore', 'Ore', 30)],
        outputs: [
          makeItemRate('plate', 'Plate', 30),
          makeItemRate('slag', 'Slag', 5),
        ],
      }),
    ];
    const model = makeModel({
      externalInputs: [makeItemRate('ore', 'Ore', 30)],
      targets: [{ itemId: 'plate', itemName: 'Plate', requestedRatePerMin: 30, actualRatePerMin: 30 }],
      surplusOutputs: [makeItemRate('slag', 'Slag', 5)],
    });

    const result = buildFlowGraphData(plans, null, model);

    const outputNodes = result.nodes.filter(n => n.id.startsWith('output-'));
    expect(outputNodes.some(n => n.id === 'output-slag')).toBe(true);
  });

  it('labels power item flows with MW units', () => {
    const catalog = {
      powerItemId: '-9001',
      proliferatorLevels: [],
    } as unknown as ResolvedCatalogModel;
    const plans: PresentationRecipePlan[] = [
      makeRecipePlan({
        inputs: [makeItemRate('fuel', 'Fuel', 2)],
        outputs: [makeItemRate('-9001', 'Power', 20)],
      }),
    ];
    const model = makeModel({
      targets: [
        {
          itemId: '-9001',
          itemName: 'Power',
          requestedRatePerMin: 20,
          actualRatePerMin: 20,
        },
      ],
    });

    const result = buildFlowGraphData(plans, catalog, model);
    const powerOutput = result.nodes.find(node => node.id === 'output--9001');
    const powerEdge = result.edges.find(edge => edge.target === 'output--9001');

    expect(powerOutput?.data.rateLabel).toBe('20.00 MW');
    expect(powerEdge?.data?.rateLabel).toBe('20.00 MW');
  });
});
