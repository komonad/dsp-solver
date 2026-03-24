import React from 'react';
import { Box, Typography } from '@mui/material';
import { formatRate } from '../../i18n';
import { EntityIcon, EntityLabelButton } from '../shared/EntityIcon';
import { openItemSliceOverlay } from '../itemSlice/itemSliceStore';
import { formatRecipeAmount, shouldOmitRecipeAmount } from './workbenchHelpers';
import { useWorkbench } from './WorkbenchContext';

// ---------------------------------------------------------------------------
// FlowRateToken
// ---------------------------------------------------------------------------

export interface FlowRateTokenProps {
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
}

export function FlowRateToken({ itemId, itemName, iconKey, ratePerMin }: FlowRateTokenProps) {
  const { locale, iconAtlasIds } = useWorkbench();

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <EntityLabelButton
        label={itemName}
        iconKey={iconKey}
        atlasIds={iconAtlasIds}
        size={18}
        gap={6}
        textStyle={{ fontSize: 13, fontWeight: 600 }}
        buttonStyle={{ display: 'inline-flex', alignItems: 'center' }}
        onClick={() => openItemSliceOverlay(itemId)}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
      >
        {formatRate(ratePerMin, locale)}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// FlowRateSequence
// ---------------------------------------------------------------------------

export interface FlowRateSequenceProps {
  items: Array<{
    itemId: string;
    itemName: string;
    iconKey?: string;
    ratePerMin: number;
  }>;
}

export function FlowRateSequence({ items }: FlowRateSequenceProps) {
  const { bundle } = useWorkbench();

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {bundle.common.none}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={`${item.itemId}:${index}`}>
          {index > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              +
            </Typography>
          ) : null}
          <FlowRateToken
            itemId={item.itemId}
            itemName={item.itemName}
            iconKey={item.iconKey}
            ratePerMin={item.ratePerMin}
          />
        </React.Fragment>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// RecipeIoSequence
// ---------------------------------------------------------------------------

export interface RecipeIoSequenceProps {
  items: Array<{
    itemId: string;
    itemName: string;
    iconKey?: string;
    ratePerMin: number;
  }>;
}

export function RecipeIoSequence({ items }: RecipeIoSequenceProps) {
  const { locale, bundle, iconAtlasIds } = useWorkbench();

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {bundle.common.none}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      {items.map((item, index) => (
        <React.Fragment key={`${item.itemId}:${index}`}>
          {index > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              +
            </Typography>
          ) : null}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            {shouldOmitRecipeAmount(item.ratePerMin) ? null : (
              <Typography
                variant="caption"
                sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#183359' }}
              >
                {formatRecipeAmount(item.ratePerMin, locale)}
              </Typography>
            )}
            <EntityIcon
              label={item.itemName}
              iconKey={item.iconKey}
              atlasIds={iconAtlasIds}
              size={20}
            />
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}
