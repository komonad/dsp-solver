/**
 * javascript-lp-solver 类型声明
 */

declare module 'javascript-lp-solver' {
  export interface LPModel {
    optimize: Record<string, number>;
    opType: 'min' | 'max';
    constraints: Record<string, { min?: number; max?: number; equal?: number }>;
    variables: Record<string, Record<string, number>>;
  }

  export interface LPSolution {
    feasible: boolean;
    result: number;
    bounded?: boolean;
    [key: string]: any;
  }

  export function Solve(model: LPModel): LPSolution;
}
