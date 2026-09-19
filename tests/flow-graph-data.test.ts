import { applyFlowGraphFocus, buildFlowGraphData } from '../src/web/app/flowGraph/buildFlowGraphData';
import { computeFocusFilter } from '../src/presentation';
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
  it('represents power as a view supply and only counts retained consumers', () => {
    const catalog = { powerItemId: 'power', proliferatorLevels: [] } as unknown as ResolvedCatalogModel;
    const plans = [
      makeRecipePlan({ recipeId: 'fuel', inputs: [makeItemRate('ore', 'Ore', 20), makeItemRate('power', 'Power', 2)], outputs: [makeItemRate('fuel', 'Fuel', 10)] }),
      makeRecipePlan({ recipeId: 'generate', inputs: [makeItemRate('fuel', 'Fuel', 10)], outputs: [makeItemRate('power', 'Power', 12)] }),
      makeRecipePlan({ recipeId: 'white', inputs: [makeItemRate('ore', 'Ore', 60), makeItemRate('power', 'Power', 10)], outputs: [makeItemRate('white', 'White', 60)] }),
    ];
    const model = makeModel({ recipePlans: plans, targets: [{ itemId: 'white', itemName: 'White', requestedRatePerMin: 60, actualRatePerMin: 60 }] });
    const before = JSON.stringify(model);
    const focus = computeFocusFilter(['white'], plans, new Set(['ore']), { viewRawInputItemIds: ['power'] });
    const graph = buildFlowGraphData(plans, catalog, model, 'zh-CN', focus);
    expect(graph.nodes.find(node => node.id === 'recipe-1')?.data.dimmed).toBe(true);
    expect(graph.nodes.find(node => node.id === 'recipe-2')?.data.inputItemIds).toContain('power');
    expect(graph.nodes.find(node => node.id === 'view-input-power')?.data).toMatchObject({
      kind: 'input', viewRawInput: true, ratePerMin: 10, rateLabel: '10.00 MW', dimmed: false,
    });
    expect(graph.edges.filter(edge => edge.data?.itemId === 'power' && !edge.data.dimmed)).toMatchObject([
      { source: 'view-input-power', target: 'recipe-2', data: { ratePerMin: 10 } },
    ]);
    expect(JSON.stringify(model)).toBe(before);
    const restored = buildFlowGraphData(plans, catalog, model);
    expect(restored.nodes.some(node => node.data.viewRawInput)).toBe(false);
    expect(restored.edges.some(edge => edge.data?.viewRawInput)).toBe(false);
    expect(restored.nodes.every(node => !node.data.dimmed)).toBe(true);
  });

  it('does not double-count actual imports or retained co-product flows at a view boundary', () => {
    const plans = [
      makeRecipePlan({ recipeId: 'refine', inputs: [makeItemRate('crude', 'Crude', 60)], outputs: [makeItemRate('oil', 'Oil', 60), makeItemRate('hydrogen', 'Hydrogen', 30)] }),
      makeRecipePlan({ recipeId: 'plastic', inputs: [makeItemRate('oil', 'Oil', 60), makeItemRate('hydrogen', 'Hydrogen', 40)], outputs: [makeItemRate('plastic', 'Plastic', 60)] }),
    ];
    const model = makeModel({ recipePlans: plans, externalInputs: [makeItemRate('hydrogen', 'Hydrogen', 10)] });
    const focus = computeFocusFilter(['plastic'], plans, new Set(['crude']), { viewRawInputItemIds: ['hydrogen'] });
    const graph = buildFlowGraphData(plans, null, model, 'zh-CN', focus);
    expect(graph.nodes.find(node => node.id === 'recipe-0')?.data.dimmed).toBe(false);
    expect(graph.nodes.find(node => node.id === 'input-hydrogen')?.data).toMatchObject({ ratePerMin: 10, dimmed: true });
    expect(graph.edges.filter(edge => edge.data?.itemId === 'hydrogen' && !edge.data.dimmed)).toMatchObject([
      { source: 'view-input-hydrogen', target: 'recipe-1', data: { ratePerMin: 40 } },
    ]);
  });

  it('supplies a directly focused target from its view boundary', () => {
    const plans = [makeRecipePlan({ inputs: [makeItemRate('ore', 'Ore', 60)], outputs: [makeItemRate('plate', 'Plate', 60)] })];
    const model = makeModel({ recipePlans: plans, targets: [{ itemId: 'plate', itemName: 'Plate', requestedRatePerMin: 60, actualRatePerMin: 60 }] });
    const focus = computeFocusFilter(['plate'], plans, new Set(), { viewRawInputItemIds: ['plate'] });
    const graph = buildFlowGraphData(plans, null, model, 'zh-CN', focus);
    expect(graph.edges.filter(edge => !edge.data?.dimmed)).toMatchObject([
      { source: 'view-input-plate', target: 'output-plate', data: { ratePerMin: 60 } },
    ]);
    expect(graph.nodes.find(node => node.id === 'recipe-0')?.data.dimmed).toBe(true);
  });

  it('exposes a normally hidden spray input at a view boundary', () => {
    const catalog = { proliferatorLevels: [{ level: 1, itemId: 'spray' }] } as unknown as ResolvedCatalogModel;
    const plans = [makeRecipePlan({
      proliferatorMode: 'speed', proliferatorLevel: 1,
      inputs: [makeItemRate('ore', 'Ore', 60), makeItemRate('spray', 'Spray', 2)],
      outputs: [makeItemRate('plate', 'Plate', 60)],
    })];
    const model = makeModel({ recipePlans: plans });
    expect(buildFlowGraphData(plans, catalog, model).nodes[0].data.inputItemIds).not.toContain('spray');
    const focus = computeFocusFilter(['plate'], plans, new Set(['ore']), { viewRawInputItemIds: ['spray'] });
    const graph = buildFlowGraphData(plans, catalog, model, 'zh-CN', focus);
    expect(graph.nodes[0].data.inputItemIds).toContain('spray');
    expect(graph.nodes.find(node => node.id === 'view-input-spray')?.data).toMatchObject({ ratePerMin: 2, dimmed: false });
    expect(graph.edges.find(edge => edge.source === 'view-input-spray')).toMatchObject({ targetHandle: 'in-spray' });
  });

  it('dims branches sharing a focused item and restores the graph without moving nodes', () => {
    const plans = [
      makeRecipePlan({ recipeId: 'smelt', inputs: [makeItemRate('ore', 'Ore', 60)], outputs: [makeItemRate('plate', 'Plate', 60)] }),
      makeRecipePlan({ recipeId: 'gear', inputs: [makeItemRate('plate', 'Plate', 30)], outputs: [makeItemRate('gear', 'Gear', 30), makeItemRate('slag', 'Slag', 5)] }),
      makeRecipePlan({ recipeId: 'circuit', inputs: [makeItemRate('plate', 'Plate', 30)], outputs: [makeItemRate('circuit', 'Circuit', 30)] }),
    ];
    const model = makeModel({
      recipePlans: plans,
      externalInputs: [makeItemRate('ore', 'Ore', 60)],
      targets: ['gear', 'circuit'].map(itemId => ({ itemId, itemName: itemId, requestedRatePerMin: 30, actualRatePerMin: 30 })),
      surplusOutputs: [makeItemRate('slag', 'Slag', 5)],
    });
    const graph = buildFlowGraphData(plans, null, model);
    graph.nodes[0].position = { x: 123, y: 456 };
    const focus = computeFocusFilter(['gear'], plans, new Set(['ore']));
    const focused = applyFlowGraphFocus(graph, focus);
    expect(focused.nodes.filter(node => node.data.dimmed).map(node => node.id)).toEqual(['recipe-2', 'output-circuit']);
    expect(focused.edges.find(edge => edge.source === 'recipe-0' && edge.target === 'recipe-1')?.data?.dimmed).toBe(false);
    expect(focused.edges.find(edge => edge.source === 'recipe-0' && edge.target === 'recipe-2')?.data?.dimmed).toBe(true);
    expect(focused.edges.find(edge => edge.target === 'output-slag')?.data?.dimmed).toBe(false);
    expect(focused.nodes[0].position).toEqual({ x: 123, y: 456 });
    expect(focused.edges.map(edge => edge.data?.ratePerMin)).toEqual(graph.edges.map(edge => edge.data?.ratePerMin));
    expect(applyFlowGraphFocus(focused, null)).toEqual(graph);
    expect(buildFlowGraphData(plans, null, model, 'zh-CN', focus).edges).toEqual(focused.edges);
  });

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
