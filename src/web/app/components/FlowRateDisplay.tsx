import React from 'react';
import { Box, Typography } from '@mui/material';
import type { AppLocale } from '../../../i18n';
import { EntityIcon, EntityLabelButton } from '../../shared/EntityIcon';
import { openItemSliceOverlay } from '../../itemSlice/state/itemSliceStore';
import {
  formatItemAmountLabel,
  formatItemRateLabel,
  shouldOmitItemAmount,
} from '../workbenchHelpers';

// ---------------------------------------------------------------------------
// FlowRateToken
// ---------------------------------------------------------------------------

export interface FlowRateTokenProps {
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
  locale: AppLocale;
  atlasIds?: string[];
  powerItemId?: string | null;
}

export function FlowRateToken({
  itemId,
  itemName,
  iconKey,
  ratePerMin,
  locale,
  atlasIds,
  powerItemId,
}: FlowRateTokenProps) {
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
        atlasIds={atlasIds}
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
        {formatItemRateLabel(itemId, ratePerMin, locale, powerItemId)}
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
  locale: AppLocale;
  atlasIds?: string[];
  noneText: string;
  powerItemId?: string | null;
}

export function FlowRateSequence({
  items,
  locale,
  atlasIds,
  noneText,
  powerItemId,
}: FlowRateSequenceProps) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {noneText}
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
            locale={locale}
            atlasIds={atlasIds}
            powerItemId={powerItemId}
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
  locale: AppLocale;
  atlasIds?: string[];
  noneText: string;
  highlightItemId?: string;
  powerItemId?: string | null;
}

export function RecipeIoSequence({
  items,
  locale,
  atlasIds,
  noneText,
  highlightItemId,
  powerItemId,
}: RecipeIoSequenceProps) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {noneText}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.375,
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
              gap: 0.125,
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            {shouldOmitItemAmount(item.itemId, item.ratePerMin, powerItemId) ? null : (
              <Typography
                variant="caption"
                sx={{ whiteSpace: 'nowrap', fontWeight: 400, color: '#183359' }}
              >
                {formatItemAmountLabel(item.itemId, item.ratePerMin, locale, powerItemId)}
              </Typography>
            )}
            <Box
              sx={highlightItemId === item.itemId
                ? {
                    display: 'inline-flex',
                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                    borderRadius: '4px',
                  }
                : { display: 'inline-flex' }}
            >
              <EntityIcon
                label={item.itemName}
                iconKey={item.iconKey}
                atlasIds={atlasIds}
                size={20}
              />
            </Box>
          </Box>
        </React.Fragment>
      ))}
    </Box>
  );
}
