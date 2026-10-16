/** Runtime-generated solid-resource samples. Amounts exclude oil and gas flow rates. */
export interface ResourceSampleSet {
  schemaVersion: 1;
  starCount: number;
  resourceMultiplier: number;
  /** Items available from oceans or gas giants receive zero default resource cost. */
  renewableItemIds?: number[];
  samples: Array<{
    seed: number;
    starCount: number;
    solidPlanetCount: number;
    amounts: Record<string, number>;
  }>;
}

/**
 * Pool equally configured seeds, then normalize inverse abundance to iron = 1.
 * Unobserved resources receive no estimate; they retain the request's default
 * cost rather than being treated as absent from every possible galaxy.
 */
export function deriveResourceScarcityWeights(value: unknown): Record<string, number> {
  const data = value as ResourceSampleSet;
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.samples) || !data.samples.length ||
      !Number.isFinite(data.resourceMultiplier) || data.resourceMultiplier <= 0 ||
      !Number.isInteger(data.starCount) || data.starCount < 1) {
    throw new Error('Invalid resource sample metadata.');
  }
  const totals: Record<string, number> = {};
  if (data.renewableItemIds !== undefined && (!Array.isArray(data.renewableItemIds) ||
      !data.renewableItemIds.every(id => Number.isInteger(id) && id > 0))) throw new Error('Invalid renewable items.');
  const renewable = new Set((data.renewableItemIds ?? []).map(String));
  const seeds = new Set<number>();
  for (const sample of data.samples) {
    if (!sample || !Number.isInteger(sample.seed) || seeds.has(sample.seed) ||
        sample.starCount !== data.starCount || !Number.isInteger(sample.solidPlanetCount) ||
        sample.solidPlanetCount <= 0 || !sample.amounts || typeof sample.amounts !== 'object' || Array.isArray(sample.amounts)) {
      throw new Error('Invalid resource sample.');
    }
    seeds.add(sample.seed);
    for (const [id, amount] of Object.entries(sample.amounts)) {
      if (!/^\d+$/.test(id) || !Number.isFinite(amount) || amount < 0) throw new Error('Invalid resource amount.');
      totals[id] = (totals[id] ?? 0) + amount;
    }
  }
  const reference = totals['1001'];
  if (!Number.isFinite(reference) || reference <= 0) throw new Error('Resource samples require iron ore.');
  return Object.fromEntries([...Object.entries(totals).filter(([id, amount]) => amount > 0 && !renewable.has(id)).map(([id, amount]) => {
    const weight = reference / amount;
    if (!Number.isFinite(amount) || !Number.isFinite(weight) || weight <= 0) throw new Error('Resource weights exceed numeric range.');
    return [id, weight];
  }), ...Array.from(renewable, id => [id, 0] as const)]);
}
