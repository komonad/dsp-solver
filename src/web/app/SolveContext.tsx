import React, { createContext, useContext, useMemo } from 'react';
import type { SolveRequest, SolveResult } from '../../solver';
import type { PresentationModel } from '../../presentation';
import type { WorkbenchSolveState } from '../workbench/autoSolve';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface SolveContextValue {
  autoSolveState: WorkbenchSolveState;
  model: PresentationModel | null;
  fallbackModel: PresentationModel | null;
  result: SolveResult | null;
  solveError: string;
  fallbackSolve: WorkbenchSolveState['fallback'];
  lastRequest: SolveRequest | undefined;
  activeSolveRequest: SolveRequest | undefined;
  requestSummary: PresentationModel['requestSummary'] | undefined;
  canStartSolve: boolean;
  canCancelSolve: boolean;
  solveCancelledForCurrentInputs: boolean;
  startSolve: () => void;
  cancelSolve: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SolveContext = createContext<SolveContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SolveProvider({
  value,
  children,
}: {
  value: SolveContextValue;
  children: React.ReactNode;
}) {
  return <SolveContext.Provider value={value}>{children}</SolveContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSolve(): SolveContextValue {
  const context = useContext(SolveContext);
  if (!context) {
    throw new Error('useSolve must be used within a SolveProvider');
  }
  return context;
}
