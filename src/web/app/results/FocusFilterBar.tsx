import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { formatPower } from '../../../i18n';
import { useCatalog } from '../CatalogContext';
import { useWorkbenchDraft } from '../WorkbenchDraftContext';
import { focusBarStyle } from '../workbenchStyles';
import ViewItemSelection from './ViewItemSelection';

export default function FocusFilterBar() {
  const { bundle, locale } = useCatalog();
  const {
    focusItemIds, focusResult, addFocusItem, removeFocusItem, clearFocusItems,
    viewRawInputItemIds, addViewRawInput, removeViewRawInput, clearViewRawInputs,
  } = useWorkbenchDraft();

  return (
    <div style={focusBarStyle} role="region" aria-label={bundle.focusFilter.focusedSectionTitle}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      <Box sx={{ minWidth: 0 }}>
      <Typography component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 600, mb: 1 }}>
        {bundle.workspace.focus}
        <Tooltip title={bundle.focusFilter.description}><HelpOutlineRoundedIcon tabIndex={0} aria-label={bundle.focusFilter.description} sx={{ fontSize: 15, color: 'text.secondary' }} /></Tooltip>
      </Typography>
      <ViewItemSelection itemIds={focusItemIds} onAdd={addFocusItem} onRemove={removeFocusItem}
        onClear={clearFocusItems} placeholder={bundle.focusFilter.placeholder}
        removeLabel={bundle.focusFilter.removeFocusButton} clearLabel={bundle.focusFilter.clearButton} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
      <Typography component="div" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, fontWeight: 600, mb: 1 }}>
        {bundle.workspace.viewInput}
        <Tooltip title={bundle.focusFilter.viewRawDescription}><HelpOutlineRoundedIcon tabIndex={0} aria-label={bundle.focusFilter.viewRawDescription} sx={{ fontSize: 15, color: 'text.secondary' }} /></Tooltip>
      </Typography>
      <ViewItemSelection itemIds={viewRawInputItemIds} onAdd={addViewRawInput} onRemove={removeViewRawInput}
        onClear={clearViewRawInputs} placeholder={bundle.focusFilter.viewRawPlaceholder}
        removeLabel={bundle.focusFilter.removeViewRawButton} clearLabel={bundle.focusFilter.clearViewRawButton} boundary />
      </Box>
      </Box>
      {focusResult ? (
        <div role="status" style={{ width: '100%', fontSize: 12, marginTop: 12, color: '#3564d8' }}>
          {bundle.focusFilter.remainingSectionTitle}: {focusResult.summary.recipeCount} {bundle.summary.recipesLabel}
          {' · '}{focusResult.summary.buildingCount} {bundle.summary.buildingsLabel}
          {' · '}{formatPower(focusResult.summary.roundedPlacementPowerMW, locale)}
        </div>
      ) : null}
    </div>
  );
}
