import { solve as solveWithYalps } from 'yalps';
import type {
  Model as YalpsModel,
  Options as YalpsOptions,
  Solution as YalpsSolution,
} from 'yalps';
import type { Model, Options, Solution, SolverImplementation } from './implementation';
import { normalizeObjectiveValue } from './implementation';

function normalizeYalpsSolution<VariableName extends string>(
  solution: YalpsSolution<VariableName>
): Solution<VariableName> {
  return {
    status: solution.status,
    result: normalizeObjectiveValue(solution.result),
    variables: new Map(solution.variables),
  };
}

export const yalpsSolverImplementation: SolverImplementation = {
  implementationId: 'yalps',
  solve<
    ConstraintName extends string = string,
    VariableName extends string = string,
  >(model: Model<ConstraintName, VariableName>, options?: Options): Solution<VariableName> {
    const yalpsModel = model as unknown as YalpsModel<VariableName, ConstraintName>;
    const yalpsOptions = options as YalpsOptions | undefined;
    return normalizeYalpsSolution(
      solveWithYalps<VariableName, ConstraintName>(yalpsModel, yalpsOptions)
    );
  },
};
