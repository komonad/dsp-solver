import React from 'react';
import { formatPower } from '../../../i18n';
import { useCatalog } from '../CatalogContext';
import { useWorkbenchDraft } from '../WorkbenchDraftContext';
import { focusBarStyle, viewFilterDescriptionStyle } from '../workbenchStyles';
import ViewItemSelection from './ViewItemSelection';

export default function FocusFilterBar() {
  const { bundle, locale } = useCatalog();
  const {
    focusItemIds, focusResult, addFocusItem, removeFocusItem, clearFocusItems,
    viewRawInputItemIds, addViewRawInput, removeViewRawInput, clearViewRawInputs,
  } = useWorkbenchDraft();

  return (
    <div style={focusBarStyle} role="region" aria-label={bundle.focusFilter.focusedSectionTitle}>
      <div style={viewFilterDescriptionStyle}>{bundle.focusFilter.description}</div>
      <ViewItemSelection itemIds={focusItemIds} onAdd={addFocusItem} onRemove={removeFocusItem}
        onClear={clearFocusItems} placeholder={bundle.focusFilter.placeholder}
        removeLabel={bundle.focusFilter.removeFocusButton} clearLabel={bundle.focusFilter.clearButton} />
      <div style={viewFilterDescriptionStyle}>{bundle.focusFilter.viewRawDescription}</div>
      <ViewItemSelection itemIds={viewRawInputItemIds} onAdd={addViewRawInput} onRemove={removeViewRawInput}
        onClear={clearViewRawInputs} placeholder={bundle.focusFilter.viewRawPlaceholder}
        removeLabel={bundle.focusFilter.removeViewRawButton} clearLabel={bundle.focusFilter.clearViewRawButton} boundary />
      {focusResult ? (
        <div role="status" style={{ width: '100%', fontSize: 12 }}>
          {bundle.focusFilter.remainingSectionTitle}: {focusResult.summary.recipeCount} {bundle.summary.recipesLabel}
          {' · '}{focusResult.summary.buildingCount} {bundle.summary.buildingsLabel}
          {' · '}{formatPower(focusResult.summary.roundedPlacementPowerMW, locale)}
        </div>
      ) : null}
    </div>
  );
}
