export interface ModelConstraint {
  equal?: number;
  min?: number;
  max?: number;
}

export interface Model<
  ConstraintName extends string = string,
  VariableName extends string = string,
> {
  direction: 'minimize' | 'maximize';
  objective: ConstraintName;
  constraints: Record<ConstraintName, ModelConstraint>;
  variables: Record<VariableName, Record<string, number>>;
  binaries?: ReadonlySet<VariableName>;
}

export interface Options {
  timeout?: number;
  tolerance?: number;
}

export interface Solution<VariableName extends string = string> {
  status: string;
  result: number;
  variables: Map<VariableName, number>;
}

export interface SolverImplementation {
  readonly implementationId: string;
  solve<
    ConstraintName extends string = string,
    VariableName extends string = string,
  >(
    model: Model<ConstraintName, VariableName>,
    options?: Options
  ): Solution<VariableName>;
}

export function normalizeObjectiveValue(value: number | undefined): number {
  return typeof value === 'number' ? value : Number.NaN;
}
