import React from 'react';
import { Box } from '@mui/material';
import { EntityIcon } from '../../shared/EntityIcon';
import RecipeCycleArrow from '../results/RecipeCycleArrow';
import { formatRecipeAmount, shouldOmitRecipeAmount } from '../workbenchHelpers';

// ---------------------------------------------------------------------------
// SelectOption
// ---------------------------------------------------------------------------

export interface SelectOptionProps {
  label: string;
  iconKey?: string;
  size?: number;
}

export function SelectOption({ label, iconKey, size = 18 }: SelectOptionProps) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: size <= 16 ? 13 : 14,
        verticalAlign: 'middle',
      }}
    >
      {label}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// RecipeOptionLabel
// ---------------------------------------------------------------------------

export interface RecipeOptionIO {
  itemId: string;
  itemName: string;
  iconKey?: string;
  amount: number;
}

export interface RecipeOptionLabelProps {
  recipeName: string;
  inputs: RecipeOptionIO[];
  outputs: RecipeOptionIO[];
  cycleTimeSec: number;
  locale: string;
  atlasIds?: string[];
  highlightItemId?: string;
}

export function RecipeOptionLabel({
  recipeName,
  inputs,
  outputs,
  cycleTimeSec,
  locale,
  atlasIds,
  highlightItemId,
}: RecipeOptionLabelProps) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        whiteSpace: 'nowrap',
        fontSize: 13,
        minWidth: 0,
      }}
    >
      <span style={{ fontWeight: 600 }}>{recipeName}</span>
      <span style={{ color: 'rgba(24,51,89,0.4)' }}>:</span>
      <IoTokens items={inputs} locale={locale} atlasIds={atlasIds} />
      <RecipeCycleArrow cycleTimeSec={cycleTimeSec} locale={locale} variant="inline" />
      <IoTokens
        items={outputs}
        locale={locale}
        atlasIds={atlasIds}
        highlightItemId={highlightItemId}
      />
    </Box>
  );
}

function IoTokens({
  items,
  locale,
  atlasIds,
  highlightItemId,
}: {
  items: RecipeOptionIO[];
  locale: string;
  atlasIds?: string[];
  highlightItemId?: string;
}) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375 }}>
      {items.map((item, index) => (
        <React.Fragment key={`${item.itemId}:${index}`}>
          {index > 0 ? (
            <span style={{ fontWeight: 700, color: 'rgba(24,51,89,0.5)', fontSize: 10 }}>+</span>
          ) : null}
          {shouldOmitRecipeAmount(item.amount) ? null : (
            <span style={{ fontWeight: 400, color: '#183359', fontSize: 11 }}>
              {formatRecipeAmount(item.amount, locale)}
            </span>
          )}
          <Box
            component="span"
            sx={highlightItemId === item.itemId
              ? {
                  display: 'inline-flex',
                  backgroundColor: 'rgba(25, 118, 210, 0.12)',
                  borderRadius: '3px',
                }
              : { display: 'inline-flex' }}
          >
            <EntityIcon
              label={item.itemName}
              iconKey={item.iconKey}
              atlasIds={atlasIds}
              size={18}
            />
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}
