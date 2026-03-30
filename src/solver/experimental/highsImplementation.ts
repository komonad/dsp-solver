import highsLoader from 'highs';
import type { Model, ModelConstraint, Options, Solution, SolverImplementation } from '../implementation';
import { normalizeObjectiveValue } from '../implementation';

interface HighsLike {
  solve(problem: string, options?: HighsSolveOptions): unknown;
}

interface HighsLoaderOptions {
  locateFile?(file: string): string;
}

interface HighsSolveOptions {
  readonly mip_rel_gap?: number;
  readonly parallel?: 'off' | 'choose' | 'on';
  readonly presolve?: 'off' | 'choose' | 'on';
  readonly time_limit?: number;
}

interface HighsSolutionColumn {
  Primal?: number;
}

interface HighsSolution {
  Status: string;
  ObjectiveValue: number;
  Columns: Record<string, HighsSolutionColumn>;
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
  // `parallel: "on"` makes some modest LPs stall for seconds in highs-js/wasm,
  // while `choose` keeps the fast path and still allows HiGHS to decide.
  parallel: 'choose',
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

function mapHighsStatus(status: string): string {
  switch (status) {
    case 'Optimal':
      return 'optimal';
    case 'Infeasible':
    case 'Primal infeasible or unbounded':
      return 'infeasible';
    case 'Unbounded':
      return 'unbounded';
    case 'Time limit reached':
      return 'timedout';
    default:
      return status.toLowerCase().replace(/\s+/g, '_');
  }
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
      const serialized = serializeModel(model);
      const result = highs.solve(serialized.modelText, compactHighsSolveOptions({
        ...baseSolveOptions,
        mip_rel_gap: typeof options?.tolerance === 'number' ? options.tolerance : solveOptions?.mip_rel_gap,
        time_limit:
          typeof options?.timeout === 'number'
            ? Math.max(0, options.timeout) / 1000
            : solveOptions?.time_limit,
      })) as HighsSolution;

      const variables = new Map<VariableName, number>();
      for (const [alias, variableName] of serialized.variableNameByAlias.entries()) {
        variables.set(variableName, result.Columns[alias]?.Primal ?? 0);
      }

      return {
        status: mapHighsStatus(result.Status),
        result: normalizeObjectiveValue(result.ObjectiveValue),
        variables,
      };
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
