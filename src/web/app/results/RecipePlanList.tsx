import React from 'react';
import RecipePlanCard from './RecipePlanCard';
import { useSolve } from '../SolveContext';
import { buildRecipePlanRevealKey } from '../../shared/recipePlanReveal';

export default function RecipePlanList() {
  const { model } = useSolve();

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
