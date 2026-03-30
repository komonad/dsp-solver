import React, { createContext, useContext } from 'react';
import type { ItemPickerOption } from '../shared/itemPickerModel';

// ---------------------------------------------------------------------------
// Context value interface
// ---------------------------------------------------------------------------

export interface WorkbenchDraftContextValue {
  // Target input drafts
  targetDraftItemId: string;
  setTargetDraftItemId: React.Dispatch<React.SetStateAction<string>>;
  targetDraftRatePerMin: number;
  setTargetDraftRatePerMin: React.Dispatch<React.SetStateAction<number>>;
  targetPickerQuery: string;
  setTargetPickerQuery: React.Dispatch<React.SetStateAction<string>>;
  targetDraftItemOption: ItemPickerOption | null;

  // Recipe plan reveal (transient UI)
  revealedRecipePlanKey: string;
  revealedRecipePlanNonce: number;
  revealRecipePlan: (planKey: string) => void;

  // Strategy warning (transient UI)
  recipeStrategyWarning: string;
  setRecipeStrategyWarning: React.Dispatch<React.SetStateAction<string>>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkbenchDraftContext = createContext<WorkbenchDraftContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function WorkbenchDraftProvider({
  value,
  children,
}: {
  value: WorkbenchDraftContextValue;
  children: React.ReactNode;
}) {
  return <WorkbenchDraftContext.Provider value={value}>{children}</WorkbenchDraftContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkbenchDraft(): WorkbenchDraftContextValue {
  const context = useContext(WorkbenchDraftContext);
  if (!context) {
    throw new Error('useWorkbenchDraft must be used within a WorkbenchDraftProvider');
  }
  return context;
}
