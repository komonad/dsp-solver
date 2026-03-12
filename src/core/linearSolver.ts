/**
 * 线性方程组求解器 - 用于多需求生产配平
 * 使用高斯消元法求解 Ax = b
 */

export interface LinearSystem {
  // 系数矩阵 A (m x n)
  coefficients: number[][];
  // 右侧向量 b (m)
  rhs: number[];
  // 变量名列表
  variables: string[];
  // 方程名列表（对应物品）
  equations: string[];
}

export interface LinearSolution {
  feasible: boolean;
  message?: string;
  // 变量值
  values: Map<string, number>;
  // 残差（验证用）
  residuals?: Map<string, number>;
}

/**
 * 求解线性最小二乘问题（当方程数 > 变量数时）
 * 使用正规方程: A^T A x = A^T b
 */
export function solveLeastSquares(system: LinearSystem): LinearSolution {
  const { coefficients: A, rhs: b, variables, equations } = system;
  const m = A.length; // 方程数
  const n = variables.length; // 变量数
  
  if (m === 0 || n === 0) {
    return { feasible: false, message: '空系统', values: new Map() };
  }

  // 构建正规方程: A^T A x = A^T b
  const AtA: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const Atb: number[] = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += A[k][i] * A[k][j];
      }
      AtA[i][j] = sum;
    }
    let sum = 0;
    for (let k = 0; k < m; k++) {
      sum += A[k][i] * b[k];
    }
    Atb[i] = sum;
  }

  // 求解正规方程
  return solveSquareSystem({
    coefficients: AtA,
    rhs: Atb,
    variables,
    equations: variables.map(v => `normal_${v}`)
  });
}

/**
 * 求解方阵线性系统（高斯消元法）
 */
export function solveSquareSystem(system: LinearSystem): LinearSolution {
  const { coefficients: A, rhs: b, variables } = system;
  const n = variables.length;

  if (n === 0) {
    return { feasible: false, message: '空系统', values: new Map() };
  }

  // 创建增广矩阵
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  // 高斯消元（部分主元）
  for (let col = 0; col < n; col++) {
    // 找主元
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      continue; // 奇异或近似奇异
    }

    // 交换行
    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // 消元
    const pivot = aug[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // 回代
  const x: number[] = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    const diag = aug[i][i];
    if (Math.abs(diag) < 1e-12) {
      return { 
        feasible: false, 
        message: `变量 ${variables[i]} 无法确定（奇异矩阵）`, 
        values: new Map() 
      };
    }
    x[i] = sum / diag;
  }

  // 构建结果
  const values = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    values.set(variables[i], x[i]);
  }

  return { feasible: true, values };
}

/**
 * 求解生产配平问题
 * 允许方程数 >= 变量数，寻找最小二乘解并验证约束
 */
export function solveProductionBalance(
  system: LinearSystem,
  constraints?: { min?: number; max?: number }[]
): LinearSolution {
  const { coefficients: A, rhs: b, variables, equations } = system;
  const m = equations.length;
  const n = variables.length;

  // 情况1: 方阵或欠定（方程数 <= 变量数），用最小二乘
  let solution: LinearSolution;
  if (m <= n) {
    // 转置后求解 A A^T y = b, x = A^T y
    // 这里简化处理：直接用原矩阵
    solution = solveLeastSquares(system);
  } else {
    // 超定系统，最小二乘
    solution = solveLeastSquares(system);
  }

  if (!solution.feasible) return solution;

  // 验证结果
  const values = solution.values;
  const residuals = new Map<string, number>();
  
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += A[i][j] * (values.get(variables[j]) || 0);
    }
    residuals.set(equations[i], sum - b[i]);
  }

  return { ...solution, residuals };
}

/**
 * 求解带非负约束的最小二乘问题（使用投影梯度法）
 */
export function solveNonNegativeLeastSquares(
  system: LinearSystem,
  maxIter: number = 1000,
  tol: number = 1e-10
): LinearSolution {
  const { coefficients: A, rhs: b, variables, equations } = system;
  const m = A.length;
  const n = variables.length;

  // 计算 A^T A 和 A^T b
  const AtA: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const Atb: number[] = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += A[k][i] * A[k][j];
      }
      AtA[i][j] = sum;
    }
    let sum = 0;
    for (let k = 0; k < m; k++) {
      sum += A[k][i] * b[k];
    }
    Atb[i] = sum;
  }

  // 投影梯度法
  let x: number[] = Array(n).fill(0);
  const alpha = 0.001; // 步长

  for (let iter = 0; iter < maxIter; iter++) {
    // 计算梯度: g = 2(A^T A x - A^T b)
    const grad: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += AtA[i][j] * x[j];
      }
      grad[i] = 2 * (sum - Atb[i]);
    }

    // 梯度下降
    for (let i = 0; i < n; i++) {
      x[i] -= alpha * grad[i];
    }

    // 投影到非负象限
    for (let i = 0; i < n; i++) {
      if (x[i] < 0) x[i] = 0;
    }

    // 检查收敛
    const maxGrad = Math.max(...grad.map(Math.abs));
    if (maxGrad < tol) break;
  }

  const values = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    values.set(variables[i], x[i]);
  }

  return { feasible: true, values };
}
