import React from 'react';
import RecipePlanCard from './RecipePlanCard';
import { useWorkbench } from '../WorkbenchContext';

export default function RecipePlanList() {
  const { model } = useWorkbench();

  if (!model) {
    return null;
  }

  return (
    <>
      {model.recipePlans.map(plan => (
        <RecipePlanCard key={`${plan.recipeId}:${plan.buildingId}:${plan.proliferatorLabel}`} plan={plan} />
      ))}
    </>
  );
}
