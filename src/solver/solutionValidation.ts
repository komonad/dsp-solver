import type { Model } from './implementation';

/** Validate primal feasibility before accepting an interrupted integer solve. */
export function isFeasibleAssignment(model: Model, values: ReadonlyMap<string, number>): boolean {
  const totals = new Map<string, { value: number; scale: number }>();
  for (const [name, coefficients] of Object.entries(model.variables)) {
    const value = values.get(name) ?? 0;
    if (!Number.isFinite(value) || value < -1e-7) return false;
    if (model.binaries?.has(name) && (value > 1 + 1e-7 || Math.abs(value - Math.round(value)) > 1e-6)) return false;
    for (const [row, coefficient] of Object.entries(coefficients)) {
      if (!model.constraints[row]) continue;
      const entry = totals.get(row) ?? { value: 0, scale: 1 };
      entry.value += coefficient * value;
      entry.scale += Math.abs(coefficient * value);
      totals.set(row, entry);
    }
  }
  for (const [row, bound] of Object.entries(model.constraints)) {
    const { value, scale } = totals.get(row) ?? { value: 0, scale: 1 };
    const tolerance = 1e-7 * scale;
    if ((bound.equal !== undefined && Math.abs(value - bound.equal) > tolerance) ||
        (bound.min !== undefined && value < bound.min - tolerance) ||
        (bound.max !== undefined && value > bound.max + tolerance)) return false;
  }
  return true;
}
