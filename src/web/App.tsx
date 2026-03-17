import React, { useEffect, useMemo, useState } from 'react';
import type { ResolvedCatalogModel } from '../catalog/spec';
import { buildPresentationModel } from '../presentation';
import type { BalancePolicy, SolveObjective, SolveRequest, SolveResult } from '../solver';
import { solveCatalogRequest } from '../solver/solve';
import { DATASET_PRESETS, loadResolvedCatalogFromUrl } from './catalogClient';

type EditableTarget = {
  itemId: string;
  ratePerMin: number;
};

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

function buildRequest(
  targets: EditableTarget[],
  objective: SolveObjective,
  balancePolicy: BalancePolicy,
  rawInputItemIds: string[]
): SolveRequest {
  return {
    targets: targets
      .filter(target => target.itemId && Number.isFinite(target.ratePerMin) && target.ratePerMin >= 0)
      .map(target => ({ itemId: target.itemId, ratePerMin: target.ratePerMin })),
    objective,
    balancePolicy,
    rawInputItemIds,
  };
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
  const [rawInputItemIds, setRawInputItemIds] = useState<string[]>([]);
  const [rawDraftItemId, setRawDraftItemId] = useState('');
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
      setRawInputItemIds([]);
      setRawDraftItemId(nextCatalog.items.find(item => item.kind !== 'utility')?.itemId ?? '');
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

  function solve() {
    if (!catalog) {
      return;
    }
    const request = buildRequest(targets, objective, balancePolicy, rawInputItemIds);
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

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
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
                          {(catalog?.itemMap.get(itemId)?.name ?? itemId) + ' ×'}
                        </button>
                      ))
                    )}
                  </div>
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
                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>OBJECTIVE</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.objective}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>BALANCE</div>
                          <div style={{ marginTop: 6 }}>{model.requestSummary.balancePolicy}</div>
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
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>Load a dataset to start building a request.</div>
                  )}
                </article>

                {model.status ? (
                  <>
                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>Targets & External Inputs</h2>
                      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {model.targets.map(target => (
                            <div key={target.itemId} style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 14, padding: 12 }}>
                              <div style={{ fontWeight: 700 }}>{target.itemName}</div>
                              <div style={{ marginTop: 4 }}>Request: {formatRate(target.requestedRatePerMin)}</div>
                              <div style={{ marginTop: 2 }}>Actual: {formatRate(target.actualRatePerMin)}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {model.externalInputs.length === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>No external inputs.</div>
                          ) : (
                            model.externalInputs.map(item => (
                              <div key={item.itemId}>
                                {item.itemName}: {formatRate(item.ratePerMin)}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </article>

                    <article style={cardStyle}>
                      <h2 style={{ marginTop: 0 }}>Buildings & Power</h2>
                      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {model.buildingSummary.map(summary => (
                            <div key={summary.buildingId} style={{ border: '1px solid rgba(24, 51, 89, 0.12)', borderRadius: 14, padding: 12 }}>
                              <div style={{ fontWeight: 700 }}>{summary.buildingName}</div>
                              <div style={{ marginTop: 4 }}>Exact: {summary.exactCount.toFixed(2)}</div>
                              <div style={{ marginTop: 2 }}>Rounded: {summary.roundedUpCount}</div>
                              <div style={{ marginTop: 2 }}>Power: {formatPower(summary.activePowerMW)}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div>Active: {formatPower(model.powerSummary?.activePowerMW ?? 0)}</div>
                          <div>Rounded Placement: {formatPower(model.powerSummary?.roundedPlacementPowerMW ?? 0)}</div>
                          <div style={{ marginTop: 10, fontWeight: 700 }}>Surplus Outputs</div>
                          {model.surplusOutputs.length === 0 ? (
                            <div style={{ color: 'rgba(24, 51, 89, 0.68)' }}>None</div>
                          ) : (
                            model.surplusOutputs.map(item => (
                              <div key={item.itemId}>
                                {item.itemName}: {formatRate(item.ratePerMin)}
                              </div>
                            ))
                          )}
                        </div>
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
                                  {plan.buildingName} • {plan.proliferatorLabel}
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
