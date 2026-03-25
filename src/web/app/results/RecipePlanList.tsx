import React from 'react';
import RecipePlanCard from './RecipePlanCard';
import { useWorkbench } from '../WorkbenchContext';
import { buildRecipePlanRevealKey } from '../../shared/recipePlanReveal';

export default function RecipePlanList() {
  const { model } = useWorkbench();

  if (!model) {
    return null;
  }

  return (
    <>
      {model.recipePlans.map(plan => (
        <RecipePlanCard key={buildRecipePlanRevealKey(plan)} plan={plan} />
      ))}
    </>
  );
}
