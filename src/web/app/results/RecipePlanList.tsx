import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import RecipePlanCard from './RecipePlanCard';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { useWorkbenchDraft } from '../WorkbenchDraftContext';
import { useFocusFilter } from '../useFocusFilter';
import { buildRecipePlanRevealKey } from '../../shared/recipePlanReveal';
import { buildRecipePlanListEntries, splitByFocus } from '../workbenchHelpers';
import { focusDividerStyle, focusDividerLabelStyle, focusDimmedStyle, recipePlanSplitLinksSx, recipePlanSplitLinkSx } from '../workbenchStyles';

export default function RecipePlanList() {
  const { model } = useSolve();
  const { bundle } = useCatalog();
  const { revealRecipePlan } = useWorkbenchDraft();
  const focusResult = useFocusFilter();

  if (!model) {
    return null;
  }
  const entries = buildRecipePlanListEntries(model.recipePlans);

  const { focused, unfocused } = splitByFocus(entries, (_, index) => !focusResult || focusResult.focusedRecipeIndices.has(index));
  const splitEntries = entries.filter(entry => entry.lineCount > 1 && entry.lineNumber === 1);

  return (
    <>
      {splitEntries.length > 0 && <Box sx={recipePlanSplitLinksSx}>
        <Typography variant="caption" color="text.secondary">同配方多条产线：</Typography>
        {splitEntries.map(entry => <Button key={entry.plan.recipeId} size="small" sx={recipePlanSplitLinkSx}
          onClick={() => revealRecipePlan(buildRecipePlanRevealKey(entry.plan))}>
          {entry.plan.recipeName}（{entry.lineCount} 条）
        </Button>)}
      </Box>}
      {focused.map(entry => (
        <RecipePlanCard key={buildRecipePlanRevealKey(entry.plan)} {...entry} />
      ))}
      {unfocused.length > 0 ? (
        <>
          <div style={focusDividerStyle}>
            <span style={focusDividerLabelStyle}>{bundle.focusFilter.unfocusedSectionTitle}</span>
          </div>
          {unfocused.map(entry => (
            <div key={buildRecipePlanRevealKey(entry.plan)} style={focusDimmedStyle}>
              <RecipePlanCard {...entry} />
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}
