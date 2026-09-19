import type { FocusFilterResult } from '../../presentation';
import { useWorkbenchDraft } from './WorkbenchDraftContext';

export function useFocusFilter(): FocusFilterResult | null {
  return useWorkbenchDraft().focusResult;
}
