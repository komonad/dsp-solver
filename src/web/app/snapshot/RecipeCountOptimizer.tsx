import { useEffect, useState } from 'react';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { Alert, Box, Button, Chip, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import { useWorkbench } from '../WorkbenchContext';
import { useSolve } from '../SolveContext';
import { resolveObjectiveWeights, updateObjectiveWeightsText } from '../../workbench/objectiveWeights';
import { buildRecipeOptimizationViewModel } from '../workbenchHelpers';
import { recipeOptimizerCardSx, recipeOptimizerMetricsSx, snapshotSummarySx } from '../workbenchStyles';
import { CostField } from './ObjectiveWeightsEditor';
import CollapsibleSnapshotSection from './CollapsibleSnapshotSection';

export default function RecipeCountOptimizer() {
  const { objective, parsedOverrides, setAdvancedOverridesText } = useWorkbench();
  const { autoSolveState, cancelSolve, startSolve } = useSolve();
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(true);
  const running = autoSolveState.activity.status === 'running';
  useEffect(() => {
    if (!running || !expanded) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [running, expanded]);
  const coefficients = resolveObjectiveWeights(objective, parsedOverrides.value, autoSolveState.result?.recipeCountOptimization?.baselineCost);
  if (coefficients.recipes <= 0 || parsedOverrides.error) return null;
  const summary = !autoSolveState.activity.staleResult ? autoSolveState.result?.recipeCountOptimization : undefined;
  const view = summary ? buildRecipeOptimizationViewModel(summary) : undefined;
  const stopped = autoSolveState.activity.status === 'cancelled' || summary?.status === 'paused';
  const elapsed = Math.max(0, now - (autoSolveState.activity.startedAtEpochMs ?? now)) / 1000;
  return <Box sx={recipeOptimizerCardSx}>
    <CollapsibleSnapshotSection title="后台优化" expanded={expanded} onExpandedChange={setExpanded}
      description="先显示可行基线，再持续搜索更优解。没有固定时间上限，达到目标差距后结束；可随时停止并保留方案。折叠面板时继续搜索。"
      headerAction={!expanded && running ? <Tooltip title="停止优化，保留方案"><IconButton size="small" color="warning" aria-label="停止优化，保留方案" onClick={cancelSolve}><StopRoundedIcon fontSize="small" /></IconButton></Tooltip> : undefined}
      collapsedContent={<Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
        <Chip size="small" variant="outlined" color={running ? 'info' : 'default'} label={running ? '搜索中' : stopped ? '已停止' : view?.title ?? '等待求解'} />
        <Typography sx={snapshotSummarySx}>{view ? `配方 ${view.recipeLabel} · 差距 ${view.gapLabel}` : '等待可行方案'}</Typography>
      </Box>}>
    <Box sx={{ display: 'grid', gap: 1.25 }}>
    <CostField label="目标最优性差距（%）" value={(parsedOverrides.value.milpRelativeGap ?? 0.01) * 100}
      onCommit={value => setAdvancedOverridesText(current => updateObjectiveWeightsText(current, { milpRelativeGap: value / 100 }))} />
    <Typography variant="caption" color="text.secondary">0 表示继续搜索直到证明最优。差距针对完整目标函数，越小要求越严格。</Typography>
    {running && <Box role="status" aria-live="polite" sx={{ display: 'grid', gap: 1 }}>
      <Typography variant="body2">{summary ? '当前方案已可使用 · 后台搜索中' : '正在计算初始可行方案'} · {elapsed.toFixed(1)} 秒</Typography>
      <LinearProgress aria-label="后台优化进行中" />
      <Button size="small" variant="outlined" color="warning" onClick={cancelSolve}>停止优化，保留方案</Button>
    </Box>}
    {(autoSolveState.activity.status === 'cancelled' || (!running && summary?.status === 'paused')) && <>
      <Alert severity="info" sx={{ py: 0 }}>已停止后台搜索，当前方案已保留。</Alert>
      <Button size="small" variant="outlined" onClick={startSolve}>重新优化</Button>
    </>}
    {view && <Box role="status" aria-live="polite" sx={{ display: 'grid', gap: 1 }}>
      {!running && autoSolveState.activity.status !== 'cancelled' && <Alert severity={view.tone} sx={{ py: 0 }}>{view.title} · {view.durationLabel}</Alert>}
      <Box sx={recipeOptimizerMetricsSx}>
        <Box><Typography variant="caption" color="text.secondary">配方种类</Typography><Typography fontWeight={700}>{view.recipeLabel}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">连续成本变化</Typography><Typography fontWeight={700}>{view.costChangeLabel}</Typography></Box>
        <Box><Typography variant="caption" color="text.secondary">最优性差距</Typography><Typography fontWeight={700}>{view.gapLabel}</Typography></Box>
      </Box>
      <Typography variant="caption" color="text.secondary">归一化连续成本 {view.finalCostLabel} + 种类惩罚 {view.penaltyCostLabel} = 总目标 {view.totalCostLabel}。</Typography>
      {view.reason && <Typography variant="caption" color="warning.main">{view.reason}</Typography>}
    </Box>}
    </Box>
    </CollapsibleSnapshotSection>
  </Box>;
}
