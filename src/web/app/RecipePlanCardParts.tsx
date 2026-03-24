import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { formatRate, type AppLocale } from '../../i18n';
import { openItemSliceOverlay } from '../itemSlice/itemSliceStore';
import { EntityIcon } from '../shared/EntityIcon';
import type { RecipePlanCardDisplayModel } from './workbenchHelpers';
import {
  recipePlanIconToggleButtonSx,
  recipePlanToggleButtonSx,
  recipePlanToggleGroupSx,
} from './workbenchStyles';

function RecipePlanFlowToken({
  itemId,
  itemName,
  iconKey,
  ratePerMin,
  locale,
  atlasIds,
  subtle = false,
}: {
  itemId: string;
  itemName: string;
  iconKey?: string;
  ratePerMin: number;
  locale: AppLocale;
  atlasIds?: string[];
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => openItemSliceOverlay(itemId)}
      aria-label={itemName}
      style={{
        border: 'none',
        padding: 0,
        margin: 0,
        background: 'transparent',
        color: subtle ? 'rgba(24, 51, 89, 0.72)' : 'inherit',
        font: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
      }}
    >
      <EntityIcon label={itemName} iconKey={iconKey} atlasIds={atlasIds} size={18} />
      <Typography
        variant="caption"
        sx={{
          whiteSpace: 'nowrap',
          fontWeight: 600,
          color: subtle ? 'rgba(24, 51, 89, 0.72)' : 'text.secondary',
        }}
      >
        {formatRate(ratePerMin, locale)}
      </Typography>
    </button>
  );
}

export function RecipePlanFlowSequence({
  items,
  locale,
  atlasIds,
  noneText,
  subtle = false,
}: {
  items: RecipePlanCardDisplayModel['visibleInputs'];
  locale: AppLocale;
  atlasIds?: string[];
  noneText: string;
  subtle?: boolean;
}) {
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
          <RecipePlanFlowToken
            itemId={item.itemId}
            itemName={item.itemName}
            iconKey={item.iconKey}
            ratePerMin={item.ratePerMin}
            locale={locale}
            atlasIds={atlasIds}
            subtle={subtle}
          />
        </React.Fragment>
      ))}
    </Box>
  );
}

export function RecipePlanToggleGroup({
  ariaLabel,
  value,
  onChange,
  children,
  testId,
}: {
  ariaLabel: string;
  value: string;
  onChange: (nextValue: string) => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label={ariaLabel}
      data-testid={testId}
      value={value}
      onChange={(_event, nextValue) => {
        if (nextValue !== null) {
          onChange(String(nextValue));
        }
      }}
      sx={recipePlanToggleGroupSx}
    >
      {children}
    </ToggleButtonGroup>
  );
}

export function RecipePlanToggleButton({
  value,
  ariaLabel,
  title,
  children,
  iconOnly = false,
  disabled = false,
  testId,
  className,
  selected,
  onChange,
  size,
  fullWidth,
  color,
}: {
  value: string;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
  iconOnly?: boolean;
  disabled?: boolean;
  testId?: string;
  className?: React.ComponentProps<typeof ToggleButton>['className'];
  selected?: React.ComponentProps<typeof ToggleButton>['selected'];
  onChange?: React.ComponentProps<typeof ToggleButton>['onChange'];
  size?: React.ComponentProps<typeof ToggleButton>['size'];
  fullWidth?: React.ComponentProps<typeof ToggleButton>['fullWidth'];
  color?: React.ComponentProps<typeof ToggleButton>['color'];
}) {
  return (
    <ToggleButton
      value={value}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      selected={selected}
      onChange={onChange}
      size={size}
      fullWidth={fullWidth}
      color={color}
      data-testid={testId}
      sx={iconOnly ? recipePlanIconToggleButtonSx : recipePlanToggleButtonSx}
    >
      {children}
    </ToggleButton>
  );
}

export function RecipePlanAuxiliaryInput({
  item,
  locale,
  atlasIds,
}: {
  item: RecipePlanCardDisplayModel['auxiliaryProliferatorInput'];
  locale: AppLocale;
  atlasIds?: string[];
}) {
  if (!item) {
    return null;
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.375,
        color: 'text.secondary',
      }}
    >
      <span>(</span>
      <RecipePlanFlowToken
        itemId={item.itemId}
        itemName={item.itemName}
        iconKey={item.iconKey}
        ratePerMin={item.ratePerMin}
        locale={locale}
        atlasIds={atlasIds}
        subtle
      />
      <span>)</span>
    </Box>
  );
}
