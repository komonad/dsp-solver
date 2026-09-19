import React from 'react';
import RecipePlanCard from './RecipePlanCard';
import { useCatalog } from '../CatalogContext';
import { useSolve } from '../SolveContext';
import { useFocusFilter } from '../useFocusFilter';
import { buildRecipePlanRevealKey } from '../../shared/recipePlanReveal';
import { splitByFocus } from '../workbenchHelpers';
import { focusDividerStyle, focusDividerLabelStyle, focusDimmedStyle } from '../workbenchStyles';

export default function RecipePlanList() {
  const { model } = useSolve();
  const { bundle } = useCatalog();
  const focusResult = useFocusFilter();

  if (!model) {
    return null;
  }

  if (!focusResult) {
    return (
      <>
        {model.recipePlans.map(plan => (
          <RecipePlanCard key={buildRecipePlanRevealKey(plan)} plan={plan} />
        ))}
      </>
    );
  }

  const { focused, unfocused } = splitByFocus(model.recipePlans, (_, index) => focusResult.focusedRecipeIndices.has(index));

  return (
    <>
      {focused.map(plan => (
        <RecipePlanCard key={buildRecipePlanRevealKey(plan)} plan={plan} />
      ))}
      {unfocused.length > 0 ? (
        <>
          <div style={focusDividerStyle}>
            <span style={focusDividerLabelStyle}>{bundle.focusFilter.unfocusedSectionTitle}</span>
          </div>
          {unfocused.map(plan => (
            <div key={buildRecipePlanRevealKey(plan)} style={focusDimmedStyle}>
              <RecipePlanCard plan={plan} />
            </div>
          ))}
        </>
      ) : null}
    </>
  );
}
