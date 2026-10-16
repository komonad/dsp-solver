import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, FormControlLabel, IconButton, Switch, TextField, Tooltip, Typography } from '@mui/material';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useWorkbench } from '../WorkbenchContext';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { resolveObjectiveWeights, updateObjectiveWeightsText } from '../../workbench/objectiveWeights';
import type { ObjectiveWeights } from '../../../solver';
import { deriveResourceScarcityWeights } from '../../../solver/resourceScarcity';
import { getObjectiveProductionScale } from '../../../solver/objectiveCosts';
import { snapshotFormalTooltipSlotProps, snapshotInlineFieldSx, snapshotSummarySx } from '../workbenchStyles';
import { buildObjectiveEditorViewModel } from '../workbenchHelpers';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';

export function CostField({ label, value, onCommit }: {
  label: string; value: number; onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const invalid = !draft.trim() || !Number.isFinite(Number(draft)) || Number(draft) < 0;
  return <TextField label={label} value={draft} type="number" size="small"
    sx={{ ...snapshotInlineFieldSx, flex: 1, minWidth: 0 }} error={invalid}
    slotProps={{ htmlInput: { min: 0, step: 'any' } }}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => { if (!invalid && Number(draft) !== value) onCommit(Number(draft)); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.querySelector('input')?.blur(); }}
  />;
}

export default function ObjectiveWeightsEditor() {
  const { catalog } = useCatalog();
  const { objective, targets, parsedOverrides, advancedOverridesText, setAdvancedOverridesText, loadedSource, isHydratingConfig } = useWorkbench();
  const { autoSolveState } = useSolve();
  const [itemId, setItemId] = useState<string | null>(null);
  const [sampleWeights, setSampleWeights] = useState<Record<string, number> | null>(null);
  const [sampleSource, setSampleSource] = useState('');
  const [sampleError, setSampleError] = useState('');
  const [expanded, setExpanded] = useState(true);
  const enabled = true;
  const sampleName = loadedSource?.presetId === 'orbitalring' ? 'OrbitalRing'
    : loadedSource?.presetId === 'vanilla' || loadedSource?.presetId === 'vanillaMkIV' ? 'Vanilla' : '';
  useEffect(() => {
    setSampleWeights(null);
    setSampleSource('');
    setSampleError('');
    if (!enabled || !sampleName) return;
    const controller = new AbortController();
    void fetch(`./${sampleName}.resource-samples.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('无法加载资源抽样数据'); return response.json(); })
      .then(value => { if (!controller.signal.aborted) { setSampleWeights(deriveResourceScarcityWeights(value)); setSampleSource(sampleName); } })
      .catch(error => { if (!controller.signal.aborted) setSampleError(String(error)); });
    return () => controller.abort();
  }, [enabled, sampleName]);
  useEffect(() => {
    if (isHydratingConfig || !sampleWeights || sampleSource !== sampleName) return;
    setAdvancedOverridesText(current => {
      try {
        const existing = current.trim() ? JSON.parse(current) : {};
        if (existing.inputWeights === undefined) return updateObjectiveWeightsText(current, { inputWeights: sampleWeights });
        const renewableDefaults = Object.fromEntries(Object.entries(sampleWeights).filter(([id, cost]) => cost === 0 && existing.inputWeights[id] === undefined));
        if (!Object.keys(renewableDefaults).length) return current;
        return updateObjectiveWeightsText(current, { inputWeights: { ...renewableDefaults, ...existing.inputWeights } });
      } catch { return current; }
    });
  }, [isHydratingConfig, objective, sampleWeights, sampleSource, sampleName, setAdvancedOverridesText]);
  useEffect(() => {
    if (isHydratingConfig || parsedOverrides.error || parsedOverrides.value.objectiveWeights || !catalog) return;
    setAdvancedOverridesText(current => {
      const existing = current.trim() ? JSON.parse(current) : {};
      if (existing.objectiveWeights) return current;
      return updateObjectiveWeightsText(current, { objectiveWeights: resolveObjectiveWeights(objective, existing,
        autoSolveState.result?.recipeCountOptimization?.baselineCost), milpTimeLimitMs: null, recipeCountPenalty: undefined });
    });
  }, [isHydratingConfig, catalog, objective, parsedOverrides, autoSolveState.result, setAdvancedOverridesText]);
  if (parsedOverrides.error) return <Alert severity="warning">请先修正高级配置 JSON，再编辑资源权重。</Alert>;
  const weights = parsedOverrides.value.inputWeights ?? {};
  const coefficients = resolveObjectiveWeights(objective, parsedOverrides.value, autoSolveState.result?.recipeCountOptimization?.baselineCost);
  const productionScale = getObjectiveProductionScale({ targets });
  const view = buildObjectiveEditorViewModel(coefficients, productionScale);
  const updateCoefficient = (key: keyof ObjectiveWeights, value: number) => setAdvancedOverridesText(current =>
    updateObjectiveWeightsText(current, { objectiveWeights: { ...coefficients, [key]: value }, recipeCountPenalty: undefined, milpTimeLimitMs: null }));
  const setWeights = (next: Record<string, number>) => setAdvancedOverridesText(
    updateObjectiveWeightsText(advancedOverridesText, { inputWeights: next })
  );
  const options = (catalog?.items ?? []).filter(item => weights[item.itemId] === undefined);
  return <CollapsibleSnapshotSection title="求解目标函数" description={view.description}
    expanded={expanded} onExpandedChange={setExpanded}
    collapsedContent={<Typography sx={snapshotSummarySx}>{view.summary}{parsedOverrides.value.singleRecipeVariant ? ' · 单配方单一方案' : ''}</Typography>}
    headerAction={sampleName ? <Tooltip slotProps={snapshotFormalTooltipSlotProps}
      title="恢复默认原料权重：按 3 个随机种子、64 星、1 倍资源抽样，铁矿成本 = 1。气体和海洋资源成本为 0，未覆盖资源默认成本为 1。重置会覆盖当前原料单位成本，各项可继续手动调整。">
      <span><IconButton size="small" aria-label="恢复默认原料权重"
        disabled={!sampleWeights || sampleSource !== sampleName}
        onClick={() => sampleWeights && setWeights(sampleWeights)}><RestartAltRoundedIcon fontSize="small" /></IconButton></span>
    </Tooltip> : undefined}>
    <Box sx={{ display: 'grid', gap: 1.25 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.5 }}>
      <CostField label="原料输入权重" value={coefficients.resources} onCommit={value => updateCoefficient('resources', value)} />
      <CostField label="占地权重" value={coefficients.footprint} onCommit={value => updateCoefficient('footprint', value)} />
      <CostField label="功耗权重" value={coefficients.power} onCommit={value => updateCoefficient('power', value)} />
      <CostField label="产线复杂度权重" value={coefficients.recipes} onCommit={value => updateCoefficient('recipes', value)} />
    </Box>
    <Tooltip title="同一配方只允许一种建筑、增产模式和等级组合；机器台数不受此限制。开启后需要离散搜索。">
      <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={parsedOverrides.value.singleRecipeVariant ?? false}
        onChange={(_, checked) => setAdvancedOverridesText(current => updateObjectiveWeightsText(current, {
          singleRecipeVariant: checked, objectiveWeights: coefficients, milpTimeLimitMs: null,
        }))} />} label={<Typography variant="caption">禁止同配方多种生产方案</Typography>} />
    </Tooltip>
    {sampleError && <Alert severity="warning">{sampleError}，仍可手动设置权重。</Alert>}
    {!autoSolveState.activity.staleResult && autoSolveState.result?.objectiveCost &&
      <Alert severity="info">
        归一化成本：原料 {autoSolveState.result.objectiveCost.resourceCost.toFixed(2)} + 占地 {autoSolveState.result.objectiveCost.footprintCost.toFixed(2)}
        {' + 功耗成本 '}{(autoSolveState.result.objectiveCost.powerCost ?? 0).toFixed(2)}
        {' = '}{autoSolveState.result.objectiveCost.total.toFixed(2)}
      </Alert>}
    <Box component="details" sx={{ minWidth: 0, '& > summary': { cursor: 'pointer', fontSize: 12, mb: 1 } }}>
    <summary>原料权重明细（{Object.keys(weights).length}）</summary>
    {Object.entries(weights).map(([id, value]) => <Box key={id} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', minWidth: 0, mb: 1.25 }}>
      <CostField label={catalog?.itemMap.get(id)?.name ?? id} value={value}
        onCommit={cost => setWeights({ ...weights, [id]: cost })} />
      <Button size="small" aria-label={`移除${catalog?.itemMap.get(id)?.name ?? id}权重`}
        onClick={() => { const next = { ...weights }; delete next[id]; setWeights(next); }}>移除</Button>
    </Box>)}
    <Box sx={{ display: 'flex', gap: 0.5, minWidth: 0 }}>
      <Autocomplete options={options} sx={{ flex: 1, minWidth: 0 }} size="small"
        value={options.find(item => item.itemId === itemId) ?? null}
        getOptionLabel={item => `${item.name} (${item.itemId})`}
        onChange={(_, item) => setItemId(item?.itemId ?? null)}
        renderInput={params => <TextField {...params} label="选择原料" />} />
      <Button size="small" disabled={!itemId} onClick={() => {
        if (itemId) setWeights({ ...weights, [itemId]: 1 });
        setItemId(null);
      }}>添加权重</Button>
    </Box>
    </Box>
    </Box>
  </CollapsibleSnapshotSection>;
}
