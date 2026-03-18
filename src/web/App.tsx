import React, { useEffect, useMemo, useState } from 'react';
import type { ProliferatorMode, ResolvedCatalogModel, ResolvedRecipeSpec } from '../catalog';
import { buildPresentationModel, buildPresentationOverviewSections } from '../presentation';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../solver';
import { solveCatalogRequest } from '../solver/solve';
import { DATASET_PRESETS, loadResolvedCatalogFromUrl } from './catalogClient';
import {
  buildGlobalProliferatorOverrides,
  buildPreferredRecipeOverrides,
  buildWorkbenchRequest,
  mergeAdvancedSolveOverrides,
  parseAdvancedSolveOverrides,
  type EditableRecipePreference,
  type EditableTarget,
  type WorkbenchProliferatorPolicy,
} from './requestBuilder';

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  background:
    'radial-gradient(circle at top left, rgba(244, 194, 102, 0.28), transparent 35%), linear-gradient(135deg, #f5efe2 0%, #dce7ef 48%, #f7f8fb 100%)',
  color: '#183359',
  fontFamily: '"IBM Plex Sans", "Noto Sans SC", sans-serif',
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '40px 24px 64px',
  display: 'grid',
  gap: 20,
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.76)',
  border: '1px solid rgba(18, 45, 77, 0.12)',
  borderRadius: 22,
  padding: 20,
  boxShadow: '0 24px 80px rgba(24, 51, 89, 0.12)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.18)',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: 'inherit',
  background: 'rgba(255,255,255,0.94)',
  color: '#183359',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 12,
  border: '1px solid rgba(24, 51, 89, 0.16)',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#183359',
  color: '#fff',
};

const subtleButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(24, 51, 89, 0.08)',
  color: '#183359',
};

function formatRate(ratePerMin: number): string {
  return `${ratePerMin.toFixed(2)}/min`;
}

function formatPower(value: number): string {
  return `${value.toFixed(2)} MW`;
}

function pickDefaultTarget(catalog: ResolvedCatalogModel): string {
  return (
    catalog.items.find(item => item.kind === 'product')?.itemId ??
    catalog.items.find(item => item.kind === 'intermediate')?.itemId ??
    catalog.items.find(item => item.kind !== 'utility')?.itemId ??
    ''
  );
}

function pickDefaultRecipePreference(catalog: ResolvedCatalogModel): string {
  return catalog.recipes[0]?.recipeId ?? '';
}

function getModeLabel(mode: ProliferatorMode): string {
  if (mode === 'none') {
    return 'None';
  }
  if (mode === 'speed') {
    return 'Speed';
  }
  return 'Productivity';
}

function sortModeOptions(modes: ProliferatorMode[]): ProliferatorMode[] {
  const order: ProliferatorMode[] = ['none', 'speed', 'productivity'];
  return order.filter(mode => modes.includes(mode));
}

export default function App() {
  const initialPreset = DATASET_PRESETS[0];
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [datasetPath, setDatasetPath] = useState(initialPreset.datasetPath);
  const [defaultConfigPath, setDefaultConfigPath] = useState(initialPreset.defaultConfigPath ?? '');
  const [catalogLabel, setCatalogLabel] = useState(initialPreset.label);
  const [catalog, setCatalog] = useState<ResolvedCatalogModel | null>(null);
  const [loadError, setLoadError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [targets, setTargets] = useState<EditableTarget[]>([]);
  const [objective, setObjective] = useState<SolveObjective>('min_buildings');
  const [balancePolicy, setBalancePolicy] = useState<BalancePolicy>('force_balance');
  const [proliferatorPolicy, setProliferatorPolicy] =
    useState<WorkbenchProliferatorPolicy>('auto');
  const [rawInputItemIds, setRawInputItemIds] = useState<string[]>([]);
  const [rawDraftItemId, setRawDraftItemId] = useState('');
  const [disabledRecipeIds, setDisabledRecipeIds] = useState<string[]>([]);
  const [disabledRecipeDraftId, setDisabledRecipeDraftId] = useState('');
  const [disabledBuildingIds, setDisabledBuildingIds] = useState<string[]>([]);
  const [disabledBuildingDraftId, setDisabledBuildingDraftId] = useState('');
  const [recipePreferences, setRecipePreferences] = useState<EditableRecipePreference[]>([]);
  const [recipePreferenceDraftId, setRecipePreferenceDraftId] = useState('');
  const [advancedOverridesText, setAdvancedOverridesText] = useState('');
  const [lastRequest, setLastRequest] = useState<SolveRequest | undefined>();
  const [result, setResult] = useState<SolveResult | null>(null);
  const [solveError, setSolveError] = useState('');

  async function loadCatalog(nextDatasetPath: string, nextDefaultConfigPath: string, nextLabel: string) {
    if (!nextDatasetPath.trim()) {
      setLoadError('Dataset path is required.');
      setCatalog(null);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError('');
      const nextCatalog = await loadResolvedCatalogFromUrl(
        nextDatasetPath.trim(),
        nextDefaultConfigPath.trim() || undefined
      );
      setCatalog(nextCatalog);
      setCatalogLabel(nextLabel);
      const nextTargetId = pickDefaultTarget(nextCatalog);
      setTargets(nextTargetId ? [{ itemId: nextTargetId, ratePerMin: 60 }] : []);
      setObjective(nextCatalog.recommendedSolve.objective ?? 'min_buildings');
      setBalancePolicy(nextCatalog.recommendedSolve.balancePolicy ?? 'force_balance');
      setProliferatorPolicy('auto');
      setRawInputItemIds([]);
      setRawDraftItemId(nextCatalog.items.find(item => item.kind !== 'utility')?.itemId ?? '');
      setDisabledRecipeIds([]);
      setDisabledRecipeDraftId(nextCatalog.recipes[0]?.recipeId ?? '');
      setDisabledBuildingIds(nextCatalog.recommendedDisabledBuildingIds);
      setDisabledBuildingDraftId('');
      setRecipePreferences([]);
      setRecipePreferenceDraftId(pickDefaultRecipePreference(nextCatalog));
      setAdvancedOverridesText('');
      setLastRequest(undefined);
      setResult(null);
      setSolveError('');
    } catch (error) {
      setCatalog(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalog(datasetPath, defaultConfigPath, catalogLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemOptions = useMemo(
    () =>
      catalog?.items
        .filter(item => item.kind !== 'utility')
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const rawOptions = useMemo(
    () => itemOptions.filter(item => !rawInputItemIds.includes(item.itemId)),
    [itemOptions, rawInputItemIds]
  );

  const recipeOptions = useMemo(
    () => catalog?.recipes.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const buildingOptions = useMemo(
    () => catalog?.buildings.slice().sort((left, right) => left.name.localeCompare(right.name)) ?? [],
    [catalog]
  );

  const disableRecipeOptions = useMemo(
    () => recipeOptions.filter(recipe => !disabledRecipeIds.includes(recipe.recipeId)),
    [recipeOptions, disabledRecipeIds]
  );

  const disableBuildingOptions = useMemo(
    () => buildingOptions.filter(building => !disabledBuildingIds.includes(building.buildingId)),
    [buildingOptions, disabledBuildingIds]
  );

  const recipePreferenceOptions = useMemo(
    () =>
      recipeOptions.filter(
        recipe => !recipePreferences.some(preference => preference.recipeId === recipe.recipeId)
      ),
    [recipeOptions, recipePreferences]
  );

  useEffect(() => {
    if (!rawDraftItemId && rawOptions.length > 0) {
      setRawDraftItemId(rawOptions[0].itemId);
      return;
    }
    if (rawDraftItemId && rawOptions.length > 0 && !rawOptions.some(item => item.itemId === rawDraftItemId)) {
      setRawDraftItemId(rawOptions[0].itemId);
    }
  }, [rawDraftItemId, rawOptions]);

  useEffect(() => {
    if (!disabledRecipeDraftId && disableRecipeOptions.length > 0) {
      setDisabledRecipeDraftId(disableRecipeOptions[0].recipeId);
      return;
    }
    if (
      disabledRecipeDraftId &&
      disableRecipeOptions.length > 0 &&
      !disableRecipeOptions.some(recipe => recipe.recipeId === disabledRecipeDraftId)
    ) {
      setDisabledRecipeDraftId(disableRecipeOptions[0].recipeId);
    }
  }, [disabledRecipeDraftId, disableRecipeOptions]);

  useEffect(() => {
    if (!disabledBuildingDraftId && disableBuildingOptions.length > 0) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
      return;
    }
    if (
      disabledBuildingDraftId &&
      disableBuildingOptions.length > 0 &&
      !disableBuildingOptions.some(building => building.buildingId === disabledBuildingDraftId)
    ) {
      setDisabledBuildingDraftId(disableBuildingOptions[0].buildingId);
    }
  }, [disabledBuildingDraftId, disableBuildingOptions]);

  useEffect(() => {
    if (!recipePreferenceDraftId && recipePreferenceOptions.length > 0) {
      setRecipePreferenceDraftId(recipePreferenceOptions[0].recipeId);
      return;
    }
    if (
      recipePreferenceDraftId &&
      recipePreferenceOptions.length > 0 &&
      !recipePreferenceOptions.some(recipe => recipe.recipeId === recipePreferenceDraftId)
    ) {
      setRecipePreferenceDraftId(recipePreferenceOptions[0].recipeId);
    }
  }, [recipePreferenceDraftId, recipePreferenceOptions]);

  const parsedOverrides = useMemo(
    () => parseAdvancedSolveOverrides(advancedOverridesText),
    [advancedOverridesText]
  );

  const model = useMemo(
    () =>
      catalog
        ? buildPresentationModel({
            catalog,
            request: lastRequest,
            result,
            datasetLabel: catalogLabel,
            datasetPath,
            defaultConfigPath: defaultConfigPath || undefined,
          })
        : null,
    [catalog, lastRequest, result, catalogLabel, datasetPath, defaultConfigPath]
  );

  const overviewSections = useMemo(
    () => (model ? buildPresentationOverviewSections(model) : null),
    [model]
  );

  function onPresetChange(nextPresetId: string) {
    setPresetId(nextPresetId);
    const preset = DATASET_PRESETS.find(entry => entry.id === nextPresetId);
    if (!preset || preset.id === 'custom') {
      setCatalogLabel('Custom Paths');
      return;
    }

    setCatalogLabel(preset.label);
    setDatasetPath(preset.datasetPath);
    setDefaultConfigPath(preset.defaultConfigPath ?? '');
    void loadCatalog(preset.datasetPath, preset.defaultConfigPath ?? '', preset.label);
  }

  function addTarget() {
    if (!catalog) {
      return;
    }
    const nextItemId =
      itemOptions.find(item => !targets.some(target => target.itemId === item.itemId))?.itemId ??
      pickDefaultTarget(catalog);
    if (nextItemId) {
      setTargets(current => [...current, { itemId: nextItemId, ratePerMin: 60 }]);
    }
  }

  function updateTarget(index: number, patch: Partial<EditableTarget>) {
    setTargets(current =>
      current.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...patch } : target
      )
    );
  }

  function removeTarget(index: number) {
    setTargets(current => current.filter((_, targetIndex) => targetIndex !== index));
  }

  function addRawOverride() {
    if (!rawDraftItemId || rawInputItemIds.includes(rawDraftItemId)) {
      return;
    }
    setRawInputItemIds(current => [...current, rawDraftItemId]);
  }

  function removeRawOverride(itemId: string) {
    setRawInputItemIds(current => current.filter(entry => entry !== itemId));
  }

  function addDisabledRecipe() {
    if (!disabledRecipeDraftId || disabledRecipeIds.includes(disabledRecipeDraftId)) {
      return;
    }
    setDisabledRecipeIds(current => [...current, disabledRecipeDraftId]);
  }

  function removeDisabledRecipe(recipeId: string) {
    setDisabledRecipeIds(current => current.filter(entry => entry !== recipeId));
  }

  function addDisabledBuilding() {
    if (!disabledBuildingDraftId || disabledBuildingIds.includes(disabledBuildingDraftId)) {
      return;
    }
    setDisabledBuildingIds(current => [...current, disabledBuildingDraftId]);
  }

  function removeDisabledBuilding(buildingId: string) {
    setDisabledBuildingIds(current => current.filter(entry => entry !== buildingId));
  }

  function addRecipePreference() {
    if (!recipePreferenceDraftId || recipePreferences.some(entry => entry.recipeId === recipePreferenceDraftId)) {
      return;
    }
    setRecipePreferences(current => [
      ...current,
      {
        recipeId: recipePreferenceDraftId,
        preferredBuildingId: '',
        preferredProliferatorMode: '',
        preferredProliferatorLevel: '',
      },
    ]);
  }

  function updateRecipePreference(recipeId: string, patch: Partial<EditableRecipePreference>) {
    setRecipePreferences(current =>
      current.map(preference =>
        preference.recipeId === recipeId ? { ...preference, ...patch } : preference
      )
    );
  }

  function removeRecipePreference(recipeId: string) {
    setRecipePreferences(current => current.filter(entry => entry.recipeId !== recipeId));
  }

  function getRecipeDefinition(recipeId: string): ResolvedRecipeSpec | undefined {
    return catalog?.recipeMap.get(recipeId);
  }

  function getRecipeBuildingOptions(recipeId: string) {
    const recipe = getRecipeDefinition(recipeId);
    if (!catalog || !recipe) {
      return [];
    }

    return recipe.allowedBuildingIds
      .map(buildingId => catalog.buildingMap.get(buildingId))
      .filter((building): building is NonNullable<typeof building> => Boolean(building))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  function getRecipeModeOptions(recipeId: string): ProliferatorMode[] {
    const recipe = getRecipeDefinition(recipeId);
    if (!recipe) {
      return [];
    }
    return sortModeOptions(Array.from(new Set(recipe.supportsProliferatorModes)));
  }

  function getRecipeLevelOptions(recipeId: string): number[] {
    const recipe = getRecipeDefinition(recipeId);
    if (!catalog || !recipe || recipe.maxProliferatorLevel <= 0) {
      return [];
    }
    return catalog.proliferatorLevels
      .map(level => level.level)
      .filter(level => level > 0 && level <= recipe.maxProliferatorLevel)
      .sort((left, right) => left - right);
  }

  function solve() {
    if (!catalog) {
      return;
    }
    if (parsedOverrides.error) {
      setResult(null);
      setSolveError(parsedOverrides.error);
      return;
    }
    const uiOverrides = mergeAdvancedSolveOverrides(
      {
        disabledRecipeIds,
        disabledBuildingIds,
      },
      mergeAdvancedSolveOverrides(
        buildPreferredRecipeOverrides(recipePreferences),
        buildGlobalProliferatorOverrides(catalog, proliferatorPolicy)
      )
    );
    const request = buildWorkbenchRequest({
      targets,
      objective,
      balancePolicy,
      rawInputItemIds,
      advancedOverrides: mergeAdvancedSolveOverrides(parsedOverrides.value, uiOverrides),
    });
    setLastRequest(request);
    if (request.targets.length === 0) {
      setResult(null);
      setSolveError('At least one valid target is required.');
      return;
    }
    try {
      setResult(solveCatalogRequest(catalog, request));
      setSolveError('');
    } catch (error) {
      setResult(null);
      setSolveError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <section style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>SOLVER WORKBENCH</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(2.2rem, 4vw, 4rem)', lineHeight: 1.02 }}>
            Switch datasets, run a strict solve request, and inspect the exact numbers the browser is rendering.
          </h1>
          <p style={{ margin: 0, maxWidth: 880, fontSize: 18, lineHeight: 1.65, color: 'rgba(24, 51, 89, 0.82)' }}>
            The page only loads a dataset, builds a solve request, runs the solver, and renders a presentation model. No hidden business calculations are recomputed inside React.
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 20 }}>
            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Dataset Source</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <select value={presetId} onChange={event => onPresetChange(event.target.value)} style={inputStyle}>
                  {DATASET_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                <input
                  value={datasetPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel('Custom Paths');
                    setDatasetPath(event.target.value);
                  }}
                  placeholder="./Vanilla.json"
                  style={inputStyle}
                />

                <input
                  value={defaultConfigPath}
                  onChange={event => {
                    setPresetId('custom');
                    setCatalogLabel('Custom Paths');
                    setDefaultConfigPath(event.target.value);
                  }}
                  placeholder="./Vanilla.defaults.json"
                  style={inputStyle}
                />

                <button
                  type="button"
                  onClick={() => void loadCatalog(datasetPath, defaultConfigPath, catalogLabel)}
                  style={buttonStyle}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Dataset'}
                </button>

                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(24, 51, 89, 0.72)' }}>
                  {DATASET_PRESETS.find(preset => preset.id === presetId)?.description ??
                    'Custom dataset paths can target any JSON files reachable from the current web root.'}
                </div>
              </div>
            </article>

            <article style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Solve Request</h2>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {targets.map((target, index) => (
                    <div
                      key={`${target.itemId}-${index}`}
                      style={{
                        display: 'grid',
                        gap: 10,
                        gridTemplateColumns: 'minmax(0, 1fr) 120px auto',
                        alignItems: 'end',
                      }}
                    >
                      <select
                        value={target.itemId}
                        onChange={event => updateTarget(index, { itemId: event.target.value })}
                        style={inputStyle}
                        disabled={!catalog}
                      >
                        {itemOptions.map(item => (
                          <option key={item.itemId} value={item.itemId}>
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={target.ratePerMin}
                        onChange={event =>
                          updateTarget(index, {
                            ratePerMin: Number(event.target.value) || 0,
                          })
                        }
                        style={inputStyle}
                      />

                      <button
                        type="button"
                        onClick={() => removeTarget(index)}
                        style={subtleButtonStyle}
                        disabled={targets.length <= 1}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button type="button" onClick={addTarget} style={subtleButtonStyle} disabled={!catalog}>
                    Add Target
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <select
                    value={objective}
                    onChange={event => setObjective(event.target.value as SolveObjective)}
                    style={inputStyle}
                  >
                    <option value="min_buildings">Min Buildings</option>
                    <option value="min_power">Min Power</option>
                    <option value="min_external_input">Min External Input</option>
                  </select>

                  <select
                    value={balancePolicy}
                    onChange={event => setBalancePolicy(event.target.value as BalancePolicy)}
                    style={inputStyle}
                  >
                    <option value="force_balance">Force Balance</option>
                    <option value="allow_surplus">Allow Surplus</option>
                  </select>

                  <select
                    value={proliferatorPolicy}
                    onChange={event =>
                      setProliferatorPolicy(event.target.value as WorkbenchProliferatorPolicy)
                    }
                    style={inputStyle}
                  >
                    <option value="auto">Spray Auto</option>
                    <option value="disable_all">No Proliferator</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <select
                      value={rawDraftItemId}
                      onChange={event => setRawDraftItemId(event.target.value)}
                      style={inputStyle}
                      disabled={!catalog || rawOptions.length === 0}
                    >
                      {rawOptions.map(item => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <button type="button" onClick={addRawOverride} style={subtleButtonStyle} disabled={!rawDraftItemId}>
                      Mark As Raw
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {rawInputItemIds.length === 0 ? (
                      <span style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>No request-level raw overrides.</span>
                    ) : (
                      rawInputItemIds.map(itemId => (
                        <button
                          key={itemId}
                          type="button"
                          onClick={() => removeRawOverride(itemId)}
                          style={{
                            borderRadius: 999,
                            border: '1px solid rgba(24, 51, 89, 0.16)',
                            background: 'rgba(24, 51, 89, 0.06)',
                            color: '#183359',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {(catalog?.itemMap.get(itemId)?.name ?? itemId) + ' x'}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DISABLED RECIPES</div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <select
                      value={disabledRecipeDraftId}
                      onChange={event => setDisabledRecipeDraftId(event.target.value)}
                      style={inputStyle}
                      disabled={!catalog || disableRecipeOptions.length === 0}
                    >
                      {disableRecipeOptions.map(recipe => (
                        <option key={recipe.recipeId} value={recipe.recipeId}>
                          {recipe.name}
                        </option>
                      ))}
                    </select>

                    <button type="button" onClick={addDisabledRecipe} style={subtleButtonStyle} disabled={!disabledRecipeDraftId}>
                      Disable
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {disabledRecipeIds.length === 0 ? (
                      <span style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>No disabled recipes.</span>
                    ) : (
                      disabledRecipeIds.map(recipeId => (
                        <button
                          key={recipeId}
                          type="button"
                          onClick={() => removeDisabledRecipe(recipeId)}
                          style={{
                            borderRadius: 999,
                            border: '1px solid rgba(24, 51, 89, 0.16)',
                            background: 'rgba(24, 51, 89, 0.06)',
                            color: '#183359',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {(catalog?.recipeMap.get(recipeId)?.name ?? recipeId) + ' x'}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DISABLED BUILDINGS</div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <select
                      value={disabledBuildingDraftId}
                      onChange={event => setDisabledBuildingDraftId(event.target.value)}
                      style={inputStyle}
                      disabled={!catalog || disableBuildingOptions.length === 0}
                    >
                      {disableBuildingOptions.map(building => (
                        <option key={building.buildingId} value={building.buildingId}>
                          {building.name}
                        </option>
                      ))}
                    </select>

                    <button type="button" onClick={addDisabledBuilding} style={subtleButtonStyle} disabled={!disabledBuildingDraftId}>
                      Disable
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {disabledBuildingIds.length === 0 ? (
                      <span style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>No disabled buildings.</span>
                    ) : (
                      disabledBuildingIds.map(buildingId => (
                        <button
                          key={buildingId}
                          type="button"
                          onClick={() => removeDisabledBuilding(buildingId)}
                          style={{
                            borderRadius: 999,
                            border: '1px solid rgba(24, 51, 89, 0.16)',
                            background: 'rgba(24, 51, 89, 0.06)',
                            color: '#183359',
                            padding: '6px 12px',
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          {(catalog?.buildingMap.get(buildingId)?.name ?? buildingId) + ' x'}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                    RECIPE PREFERENCES
                  </div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                    <select
                      value={recipePreferenceDraftId}
                      onChange={event => setRecipePreferenceDraftId(event.target.value)}
                      style={inputStyle}
                      disabled={!catalog || recipePreferenceOptions.length === 0}
                    >
                      {recipePreferenceOptions.map(recipe => (
                        <option key={recipe.recipeId} value={recipe.recipeId}>
                          {recipe.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={addRecipePreference}
                      style={subtleButtonStyle}
                      disabled={!recipePreferenceDraftId}
                    >
                      Add Preference
                    </button>
                  </div>

                  <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13, lineHeight: 1.5 }}>
                    These are soft per-recipe preferences. The advanced JSON panel is still available for forced overrides and less common fields.
                  </div>

                  {recipePreferences.length === 0 ? (
                    <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>No recipe-level preferences.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {recipePreferences.map(preference => {
                        const recipe = catalog?.recipeMap.get(preference.recipeId);
                        const buildingChoices = getRecipeBuildingOptions(preference.recipeId);
                        const modeChoices = getRecipeModeOptions(preference.recipeId);
                        const levelChoices = getRecipeLevelOptions(preference.recipeId);
                        const levelSelectDisabled =
                          proliferatorPolicy === 'disable_all' ||
                          levelChoices.length === 0 ||
                          preference.preferredProliferatorMode === 'none';

                        return (
                          <div
                            key={preference.recipeId}
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(24, 51, 89, 0.12)',
                              background: 'rgba(255,255,255,0.6)',
                              padding: 14,
                              display: 'grid',
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                alignItems: 'center',
                                flexWrap: 'wrap',
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>{recipe?.name ?? preference.recipeId}</div>
                              <button
                                type="button"
                                onClick={() => removeRecipePreference(preference.recipeId)}
                                style={subtleButtonStyle}
                              >
                                Remove
                              </button>
                            </div>

                            <div
                              style={{
                                display: 'grid',
                                gap: 10,
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              }}
                            >
                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                  PREFERRED BUILDING
                                </div>
                                <select
                                  value={preference.preferredBuildingId}
                                  onChange={event =>
                                    updateRecipePreference(preference.recipeId, {
                                      preferredBuildingId: event.target.value,
                                    })
                                  }
                                  style={inputStyle}
                                >
                                  <option value="">Auto</option>
                                  {buildingChoices.map(building => (
                                    <option key={building.buildingId} value={building.buildingId}>
                                      {building.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                  PREFERRED SPRAY MODE
                                </div>
                                <select
                                  value={preference.preferredProliferatorMode}
                                  onChange={event => {
                                    const nextMode = event.target.value as '' | ProliferatorMode;
                                    updateRecipePreference(preference.recipeId, {
                                      preferredProliferatorMode: nextMode,
                                      preferredProliferatorLevel:
                                        nextMode === 'none'
                                          ? ''
                                          : preference.preferredProliferatorLevel,
                                    });
                                  }}
                                  style={inputStyle}
                                  disabled={proliferatorPolicy === 'disable_all'}
                                >
                                  <option value="">Auto</option>
                                  {modeChoices.map(mode => (
                                    <option key={mode} value={mode}>
                                      {getModeLabel(mode)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div style={{ display: 'grid', gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                                  PREFERRED SPRAY LEVEL
                                </div>
                                <select
                                  value={preference.preferredProliferatorLevel === '' ? '' : String(preference.preferredProliferatorLevel)}
                                  onChange={event =>
                                    updateRecipePreference(preference.recipeId, {
                                      preferredProliferatorLevel: event.target.value
                                        ? Number(event.target.value)
                                        : '',
                                    })
                                  }
                                  style={inputStyle}
                                  disabled={levelSelectDisabled}
                                >
                                  <option value="">Auto</option>
                                  {levelChoices.map(level => (
                                    <option key={level} value={String(level)}>
                                      Level {level}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                    ADVANCED OVERRIDES JSON
                  </div>
                  <textarea
                    value={advancedOverridesText}
                    onChange={event => setAdvancedOverridesText(event.target.value)}
                    placeholder={'{\n  "preferredBuildingByRecipe": { "1": "5002" },\n  "forcedProliferatorModeByRecipe": { "2": "speed" }\n}'}
                    style={{
                      ...inputStyle,
                      minHeight: 140,
                      resize: 'vertical',
                      fontFamily: '"IBM Plex Mono", monospace',
                    }}
                  />
                  {parsedOverrides.error ? (
                    <div style={{ color: '#8e2020', fontSize: 13 }}>{parsedOverrides.error}</div>
                  ) : (
                    <div style={{ color: 'rgba(24, 51, 89, 0.58)', fontSize: 13 }}>
                      Use this for advanced request fields such as preferred or forced building, recipe, and proliferator settings.
                    </div>
                  )}
                </div>

                <button type="button" onClick={solve} style={buttonStyle} disabled={!catalog}>
                  Solve
                </button>
              </div>
            </article>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            {loadError ? (
              <article style={{ ...cardStyle, borderColor: 'rgba(180, 41, 41, 0.2)' }}>
                <h2 style={{ marginTop: 0, color: '#8e2020' }}>Dataset Load Error</h2>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{loadError}</pre>
              </article>
            ) : null}

            {model ? (
              <>
                <article style={cardStyle}>
                  <h2 style={{ marginTop: 0 }}>Catalog Summary</h2>
                  <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DATASET</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.datasetLabel ?? 'Custom'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>ITEMS</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.itemCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>RECIPES</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.recipeCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>BUILDINGS</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.buildingCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>RAW DEFAULTS</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.rawItemCount}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>TARGETABLE</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700 }}>{model.catalogSummary.targetableItemCount}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(24, 51, 89, 0.72)' }}>
                    <div>Dataset: {model.catalogSummary.datasetPath ?? '(not set)'}</div>
                    <div>Defaults: {model.catalogSummary.defaultConfigPath ?? '(none)'}</div>
                  </div>
                </article>

                <article style={cardStyle}>
                  <h2 style={{ marginTop: 0 }}>Solve Snapshot</h2>
                  {solveError ? <div style={{ color: '#8e2020', fontWeight: 700 }}>{solveError}</div> : null}
                  {model.requestSummary ? (
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>OBJECTIVE</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.objective}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>BALANCE</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.balancePolicy}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>SPRAY</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.proliferatorPolicyLabel}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>STATUS</div>
                          <div style={{ marginTop: 6 }}>{model.status ?? 'Not solved yet'}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>TARGETS</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                          {model.requestSummary.targets.map(target => (
                            <div key={target.itemId}>
                              {target.itemName}: {formatRate(target.ratePerMin)}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>RAW OVERRIDES</div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                          {model.requestSummary.rawInputs.length === 0
                            ? 'None'
                            : model.requestSummary.rawInputs.map(item => <div key={item.itemId}>{item.itemName}</div>)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DISABLED RECIPES</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.disabledRecipes.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>DISABLED BUILDINGS</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.disabledBuildings.length}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>ADVANCED OVERRIDES</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.hasAdvancedOverrides ? 'Yes' : 'No'}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>
                          RECIPE PREFERENCES
                        </div>
                        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                          {model.requestSummary.preferredRecipeSettings.length === 0 ? (
                            <div>None</div>
                          ) : (
                            model.requestSummary.preferredRecipeSettings.map(setting => (
                              <div key={setting.recipeId}>
                                {setting.recipeName}
                                {setting.buildingName ? ` | ${setting.buildingName}` : ''}
                                {setting.proliferatorPreferenceLabel
                                  ? ` | ${setting.proliferatorPreferenceLabel}`
                                  : ''}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>Load a dataset to start building a request.</div>
                  )}
                </article>

                {model.status ? (
                  <>
                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{overviewSections?.targetsAndExternalInputs.title}</h2>
                      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {overviewSections?.targetsAndExternalInputs.targets.map(target => (
                            <div key={target.itemId} style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 14, padding: 12 }}>
                              <div style={{ fontWeight: 700 }}>{target.itemName}</div>
                              <div style={{ marginTop: 4 }}>Request: {formatRate(target.requestedRatePerMin)}</div>
                              <div style={{ marginTop: 2 }}>Actual: {formatRate(target.actualRatePerMin)}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(overviewSections?.targetsAndExternalInputs.externalInputs.length ?? 0) === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>No external inputs.</div>
                          ) : (
                            overviewSections?.targetsAndExternalInputs.externalInputs.map(item => (
                              <div key={item.itemId}>
                                {item.itemName}: {formatRate(item.ratePerMin)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{overviewSections?.buildingsAndPower.title}</h2>
                      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {overviewSections?.buildingsAndPower.buildingSummary.map(summary => (
                            <div key={summary.buildingId} style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 14, padding: 12 }}>
                              <div style={{ fontWeight: 700 }}>{summary.buildingName}</div>
                              <div style={{ marginTop: 4 }}>Exact: {summary.exactCount.toFixed(2)}</div>
                              <div style={{ marginTop: 2 }}>Rounded: {summary.roundedUpCount}</div>
                              <div style={{ marginTop: 2 }}>Power: {formatPower(summary.activePowerMW)}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div>Active: {formatPower(overviewSections?.buildingsAndPower.activePowerMW ?? 0)}</div>
                          <div>Rounded Placement: {formatPower(overviewSections?.buildingsAndPower.roundedPlacementPowerMW ?? 0)}</div>
                        </div>
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>{overviewSections?.surplusOutputs.title}</h2>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {(overviewSections?.surplusOutputs.items.length ?? 0) === 0 ? (
                          <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>None</div>
                        ) : (
                          overviewSections?.surplusOutputs.items.map(item => (
                            <div key={item.itemId}>
                              {item.itemName}: {formatRate(item.ratePerMin)}
                            </div>
                          ))
                        )}
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>Recipe Plans</h2>
                      <div style={{ display: 'grid', gap: 12 }}>
                        {model.recipePlans.map(plan => (
                          <div
                            key={`${plan.recipeId}:${plan.buildingId}:${plan.proliferatorLabel}`}
                            style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 16, padding: 16, display: 'grid', gap: 10 }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.recipeName}</div>
                                <div style={{ marginTop: 4, fontSize: 14, color: 'rgba(24, 51, 89, 0.72)' }}>
                                  {plan.buildingName} | {plan.proliferatorLabel}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div>{formatRate(plan.runsPerMin)}</div>
                                <div style={{ marginTop: 4, fontSize: 14 }}>
                                  {plan.exactBuildingCount.toFixed(2)} exact / {plan.roundedUpBuildingCount} rounded
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>INPUTS</div>
                                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                  {plan.inputs.map(input => (
                                    <div key={input.itemId}>
                                      {input.itemName}: {formatRate(input.ratePerMin)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>OUTPUTS</div>
                                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                                  {plan.outputs.map(output => (
                                    <div key={output.itemId}>
                                      {output.itemName}: {formatRate(output.ratePerMin)}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>POWER</div>
                                <div style={{ marginTop: 8 }}>{formatPower(plan.activePowerMW)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>Diagnostics & Audit</h2>
                      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>Diagnostics</div>
                          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                            {model.diagnostics &&
                            model.diagnostics.messages.length === 0 &&
                            model.diagnostics.unmetPreferences.length === 0 ? (
                              <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>No diagnostics.</div>
                            ) : (
                              <>
                                {(model.diagnostics?.messages ?? []).map((message, index) => (
                                  <div key={`message-${index}`}>{message}</div>
                                ))}
                                {(model.diagnostics?.unmetPreferences ?? []).map((message, index) => (
                                  <div key={`pref-${index}`}>{message}</div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontWeight: 700 }}>Item Balance</div>
                          <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 280, overflow: 'auto' }}>
                            {model.itemBalance.map(entry => (
                              <div key={entry.itemId} style={{ paddingBottom: 6, borderBottom: '1px solid rgba(24, 51, 89, 0.08)' }}>
                                <div style={{ fontWeight: 700 }}>{entry.itemName}</div>
                                <div style={{ fontSize: 13 }}>
                                  Produced {formatRate(entry.producedRatePerMin)} / Consumed {formatRate(entry.consumedRatePerMin)} / Net {formatRate(entry.netRatePerMin)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <details style={{ marginTop: 14 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Solve Request JSON</summary>
                        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
                          {JSON.stringify(lastRequest, null, 2)}
                        </pre>
                      </details>
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Solve Result JSON</summary>
                        <pre style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(24, 51, 89, 0.06)', overflow: 'auto', fontSize: 13 }}>
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                    </article>
                  </>
                ) : (
                  <article style={cardStyle}>
                    <h2 style={{ marginTop: 0 }}>Ready To Solve</h2>
                    <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                      The catalog is loaded. Adjust the request on the left and click Solve to render results.
                    </p>
                  </article>
                )}
              </>
            ) : (
              <article style={cardStyle}>
                <h2 style={{ marginTop: 0 }}>Waiting For Dataset</h2>
                <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(24, 51, 89, 0.78)' }}>
                  Load one of the bundled datasets or point the page at your own dataset files.
                </p>
              </article>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
