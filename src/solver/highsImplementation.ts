import highsLoader from 'highs';
import type { Model, ModelConstraint, Options, Solution, SolverImplementation } from './implementation';
import { normalizeObjectiveValue } from './implementation';

type HighsLike = Awaited<ReturnType<typeof highsLoader>>;

interface HighsLoaderOptions {
  locateFile?(file: string): string;
}

interface HighsSolveOptions {
  readonly mip_rel_gap?: number;
  readonly parallel?: 'off' | 'choose' | 'on';
  readonly presolve?: 'off' | 'choose' | 'on';
  readonly time_limit?: number;
}

export interface LoadHighsImplementationOptions {
  locateFile?: (file: string) => string;
  solveOptions?: HighsSolveOptions;
}

interface SerializedModel<VariableName extends string> {
  modelText: string;
  variableNameByAlias: Map<string, VariableName>;
}

const DEFAULT_HIGHS_SOLVE_OPTIONS: HighsSolveOptions = {
  presolve: 'on',
};

const MAX_LP_LINE_LENGTH = 240;
const LP_CONTINUATION_PREFIX = '  ';

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot serialize non-finite coefficient ${value}.`);
  }

  if (Object.is(value, -0)) {
    return '0';
  }

  return Number.isInteger(value) ? value.toString() : value.toPrecision(16);
}

function pushLinearExpressionTerm(parts: string[], coefficient: number, alias: string): void {
  if (Math.abs(coefficient) <= 0) {
    return;
  }

  const sign = coefficient < 0 ? '-' : '+';
  const magnitude = Math.abs(coefficient);
  const serializedMagnitude = Math.abs(magnitude - 1) <= 1e-12 ? '' : `${formatNumber(magnitude)} `;
  parts.push(`${sign} ${serializedMagnitude}${alias}`);
}

function serializeLinearExpressionTerms<VariableName extends string>(
  variableTerms: Array<[VariableName, number]>,
  variableAliasMap: Map<VariableName, string>
): string[] {
  const parts: string[] = [];

  for (const [variableName, coefficient] of variableTerms) {
    if (Math.abs(coefficient) <= 0) {
      continue;
    }

    const alias = variableAliasMap.get(variableName);
    if (!alias) {
      continue;
    }

    pushLinearExpressionTerm(parts, coefficient, alias);
  }

  return parts;
}

function appendWrappedLpExpression(
  lines: string[],
  prefix: string,
  serializedTerms: string[],
  suffix?: string
): void {
  const effectiveTerms = serializedTerms.length > 0 ? serializedTerms : ['0'];
  let currentLine = prefix;

  for (const serializedTerm of effectiveTerms) {
    const separator = currentLine === prefix ? '' : ' ';
    if (
      currentLine !== prefix &&
      currentLine.length + separator.length + serializedTerm.length > MAX_LP_LINE_LENGTH
    ) {
      lines.push(currentLine);
      currentLine = `${LP_CONTINUATION_PREFIX}${serializedTerm}`;
      continue;
    }

    currentLine = `${currentLine}${separator}${serializedTerm}`;
  }

  if (!suffix) {
    lines.push(currentLine);
    return;
  }

  const suffixedLine = `${currentLine} ${suffix}`;
  if (currentLine !== prefix && suffixedLine.length > MAX_LP_LINE_LENGTH) {
    lines.push(currentLine);
    lines.push(`${LP_CONTINUATION_PREFIX}${suffix}`);
    return;
  }

  lines.push(suffixedLine);
}

function appendConstraintRow<VariableName extends string>(
  lines: string[],
  rowAlias: string,
  relation: '<=' | '>=' | '=',
  bound: number,
  terms: Array<[VariableName, number]>,
  variableAliasMap: Map<VariableName, string>
): void {
  appendWrappedLpExpression(
    lines,
    ` ${rowAlias}: `,
    serializeLinearExpressionTerms(terms, variableAliasMap),
    `${relation} ${formatNumber(bound)}`
  );
}

function appendConstraintRows<VariableName extends string>(
  lines: string[],
  baseAlias: string,
  constraint: ModelConstraint,
  terms: Array<[VariableName, number]>,
  variableAliasMap: Map<VariableName, string>
): void {
  if (typeof constraint.equal === 'number') {
    appendConstraintRow(lines, baseAlias, '=', constraint.equal, terms, variableAliasMap);
    return;
  }

  let emitted = false;
  if (typeof constraint.min === 'number') {
    appendConstraintRow(lines, `${baseAlias}_min`, '>=', constraint.min, terms, variableAliasMap);
    emitted = true;
  }
  if (typeof constraint.max === 'number') {
    appendConstraintRow(lines, emitted ? `${baseAlias}_max` : baseAlias, '<=', constraint.max, terms, variableAliasMap);
  }
}

function serializeModel<ConstraintName extends string, VariableName extends string>(
  model: Model<ConstraintName, VariableName>
): SerializedModel<VariableName> {
  const variableNames = Object.keys(model.variables).sort() as VariableName[];
  const variableAliasMap = new Map<VariableName, string>();
  const variableNameByAlias = new Map<string, VariableName>();
  for (let index = 0; index < variableNames.length; index += 1) {
    const variableName = variableNames[index];
    const alias = `v${index}`;
    variableAliasMap.set(variableName, alias);
    variableNameByAlias.set(alias, variableName);
  }

  const objectiveTerms: Array<[VariableName, number]> = [];
  const termsByConstraint = new Map<ConstraintName, Array<[VariableName, number]>>();
  for (const variableName of variableNames) {
    const coefficients = model.variables[variableName];
    const objectiveCoefficient = coefficients[model.objective];
    if (typeof objectiveCoefficient === 'number' && objectiveCoefficient !== 0) {
      objectiveTerms.push([variableName, objectiveCoefficient]);
    }

    for (const [constraintName, coefficient] of Object.entries(coefficients) as Array<
      [ConstraintName, number]
    >) {
      if (constraintName === model.objective || coefficient === 0) {
        continue;
      }

      const terms = termsByConstraint.get(constraintName) ?? [];
      terms.push([variableName, coefficient]);
      termsByConstraint.set(constraintName, terms);
    }
  }

  const lines: string[] = [model.direction === 'maximize' ? 'Maximize' : 'Minimize'];
  // HiGHS' LP reader is sensitive to some very long single-line expressions in the CPLEX LP format.
  appendWrappedLpExpression(lines, ' obj: ', serializeLinearExpressionTerms(objectiveTerms, variableAliasMap));
  lines.push('Subject To');

  const constraintNames = Object.keys(model.constraints).sort() as ConstraintName[];
  for (let index = 0; index < constraintNames.length; index += 1) {
    const constraintName = constraintNames[index];
    const constraint = model.constraints[constraintName];
    const terms = termsByConstraint.get(constraintName) ?? [];
    appendConstraintRows(lines, `c${index}`, constraint, terms, variableAliasMap);
  }

  lines.push('Bounds');
  const binaryNames = model.binaries ?? new Set<VariableName>();
  for (const variableName of variableNames) {
    if (binaryNames.has(variableName)) {
      continue;
    }
    const alias = variableAliasMap.get(variableName);
    if (!alias) {
      continue;
    }
    lines.push(` 0 <= ${alias}`);
  }

  if (binaryNames.size > 0) {
    lines.push('Binaries');
    for (const variableName of Array.from(binaryNames).sort()) {
      const alias = variableAliasMap.get(variableName);
      if (alias) {
        lines.push(` ${alias}`);
      }
    }
  }

  lines.push('End');
  return {
    modelText: lines.join('\n'),
    variableNameByAlias,
  };
}

function compactHighsSolveOptions(options: HighsSolveOptions): HighsSolveOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => typeof value !== 'undefined')
  ) as HighsSolveOptions;
}

function buildHighsImplementationId(solveOptions?: HighsSolveOptions): string {
  const effectiveOptions = compactHighsSolveOptions({
    ...DEFAULT_HIGHS_SOLVE_OPTIONS,
    ...solveOptions,
  });
  const optionEntries = Object.entries(effectiveOptions).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  if (optionEntries.length === 0) {
    return 'highs';
  }

  return `highs:${optionEntries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',')}`;
}

function createHighsSolverImplementation(
  highs: HighsLike,
  solveOptions?: HighsSolveOptions
): SolverImplementation {
  const baseSolveOptions = compactHighsSolveOptions({
    ...DEFAULT_HIGHS_SOLVE_OPTIONS,
    ...solveOptions,
  });

  return {
    implementationId: buildHighsImplementationId(solveOptions),
    solve<
      ConstraintName extends string = string,
      VariableName extends string = string,
    >(model: Model<ConstraintName, VariableName>, options?: Options): Solution<VariableName> {
      const startedAt = performance.now();
      const serialized = serializeModel(model);
      const persistent = highs.createModel({ format: 'lp', data: serialized.modelText });
      try {
        const { parallel: _parallel, ...supportedOptions } = baseSolveOptions;
        persistent.options.set({ ...compactHighsSolveOptions({
          ...supportedOptions,
          mip_rel_gap: options?.tolerance ?? solveOptions?.mip_rel_gap,
          time_limit: options?.timeout !== undefined ? Math.max(0, options.timeout) / 1000 : solveOptions?.time_limit,
        }) });
        const columnIndices = new Map(Array.from(serialized.variableNameByAlias, ([alias, name]) =>
          [name, persistent.getColByName(alias)] as const));
        if (options?.initialSolution) {
          const values = new Float64Array(columnIndices.size);
          for (const [name, index] of columnIndices) values[index] = options.initialSolution.get(name) ?? 0;
          persistent.setSolution({ colValue: values });
        }
        if (options?.timeout !== undefined) {
          // Include serialization and primal-start preparation in the caller's
          // budget, leaving a small allowance for solution copying and disposal.
          const allowance = Math.min(50, options.timeout / 10);
          persistent.options.set('time_limit', Math.max(0, options.timeout - (performance.now() - startedAt) - allowance) / 1000);
        }
        let lastPublish = -Infinity;
        let incumbentValues = options?.initialSolution ? new Map(options.initialSolution) : undefined;
        const emit = (values: Float64Array | undefined, gap: number | undefined, bound: number | undefined) => {
          if (values) incumbentValues = new Map(Array.from(columnIndices, ([name, index]) => [name, values[index]]));
          if (!options?.onIncumbent || !incumbentValues || performance.now() - lastPublish < 1000) return;
          lastPublish = performance.now();
          let incumbentObjective = 0;
          for (const [name] of columnIndices) incumbentObjective +=
            (model.variables[name][model.objective] ?? 0) * (incumbentValues.get(name) ?? 0);
          const incumbentGap = bound !== undefined && Number.isFinite(bound)
            ? Math.abs(incumbentObjective - bound) / Math.max(Math.abs(incumbentObjective), 1e-12) : gap;
          options.onIncumbent({ status: 'timedout', result: incumbentObjective, variables: new Map(incumbentValues), mipGap: incumbentGap, bestBound: bound });
        };
        const run = persistent.run(options?.onIncumbent ? {
          [highs.constants.callbackType.mipImprovingSolution]: event => {
            emit(event.data.mip_solution, event.data.mip_gap, event.data.mip_dual_bound);
            return undefined;
          },
          [highs.constants.callbackType.mipLogging]: event => {
            emit(undefined, event.data.mip_gap, event.data.mip_dual_bound);
            return undefined;
          },
        } : undefined);
        const values = persistent.getSolution().colValue;
        const statuses = highs.constants.modelStatus;
        const status = run.modelStatus === statuses.optimal ? 'optimal'
          : run.modelStatus === statuses.timeLimit ? 'timedout'
          : run.modelStatus === statuses.infeasible ? 'infeasible'
          : run.modelStatus === statuses.unbounded ? 'unbounded'
          : `highs_status_${run.modelStatus}`;
        return {
          status,
          result: normalizeObjectiveValue(persistent.getObjectiveValue()),
          variables: new Map(Array.from(columnIndices, ([name, index]) => [name, values[index]])),
          ...(model.binaries?.size ? {
            mipGap: Number(persistent.info.get('mip_gap')),
            bestBound: Number(persistent.info.get('mip_dual_bound')),
          } : {}),
        };
      } finally {
        persistent.dispose();
      }
    },
  };
}

export async function loadHighsSolverImplementation(
  options: LoadHighsImplementationOptions = {}
): Promise<SolverImplementation> {
  const loaderOptions: HighsLoaderOptions | undefined = options.locateFile
    ? { locateFile: options.locateFile }
    : undefined;
  const highs = (await highsLoader(loaderOptions)) as unknown as HighsLike;
  return createHighsSolverImplementation(highs, options.solveOptions);
}
