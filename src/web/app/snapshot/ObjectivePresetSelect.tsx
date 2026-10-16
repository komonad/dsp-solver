import { MenuItem, TextField } from '@mui/material';
import type { SolveObjective } from '../../../solver';
import { useWorkbench } from '../WorkbenchContext';
import { useSolve } from '../SolveContext';
import { OBJECTIVE_PRESETS, matchObjectivePreset, resolveObjectiveWeights, updateObjectiveWeightsText } from '../../workbench/objectiveWeights';
import { snapshotSelectFieldSx } from '../workbenchStyles';

export default function ObjectivePresetSelect() {
  const { objective, setObjective, parsedOverrides, setAdvancedOverridesText } = useWorkbench();
  const { autoSolveState } = useSolve();
  const weights = resolveObjectiveWeights(objective, parsedOverrides.value, autoSolveState.result?.recipeCountOptimization?.baselineCost);
  return <TextField select size="small" label="推荐预设" value={matchObjectivePreset(weights)}
    disabled={Boolean(parsedOverrides.error)} sx={{ ...snapshotSelectFieldSx, flex: '1 1 140px', minWidth: 140 }}
    onChange={event => {
      const next = event.target.value as SolveObjective;
      setObjective(next);
      setAdvancedOverridesText(current => updateObjectiveWeightsText(current, {
        objectiveWeights: { ...OBJECTIVE_PRESETS[next] }, recipeCountPenalty: undefined, milpTimeLimitMs: null,
      }));
    }}>
    <MenuItem value="custom" disabled>自定义目标</MenuItem>
    <MenuItem value="min_buildings">占地优先</MenuItem>
    <MenuItem value="min_power">功耗优先</MenuItem>
    <MenuItem value="min_external_input">原料优先</MenuItem>
    <MenuItem value="min_weighted">资源与占地平衡</MenuItem>
    <MenuItem value="min_complexity">精简产线</MenuItem>
  </TextField>;
}
