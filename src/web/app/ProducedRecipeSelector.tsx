import React, { useEffect, useMemo, useState } from 'react';
import { Box, MenuItem, TextField } from '@mui/material';
import type { ItemPickerOption } from '../shared/itemPickerModel';
import ItemGridPicker from '../shared/ItemGridPicker';
import {
  compactSelectFieldSx,
} from './workbenchStyles';
import {
  filterItemOptionsByRecipeAvailability,
  filterRecipeOptionsByExclusion,
  type WorkbenchRecipeOption,
} from './workbenchHelpers';
import { RecipeOptionLabel } from './SelectOption';

export interface ProducedRecipeSelectorProps {
  locale: string;
  atlasIds?: string[];
  itemOptions: ItemPickerOption[];
  recipeOptionsByItem: Record<string, WorkbenchRecipeOption[]>;
  selectedItemId: string;
  onSelectedItemChange: (itemId: string) => void;
  selectedRecipeId: string;
  onSelectedRecipeChange: (recipeId: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  emptyText: string;
  recipeLabel: string;
  emptySelectionLabel: string;
  getExcludedRecipeIds?: (itemId: string) => string[];
  disabled?: boolean;
}

export default function ProducedRecipeSelector({
  locale,
  atlasIds,
  itemOptions,
  recipeOptionsByItem,
  selectedItemId,
  onSelectedItemChange,
  selectedRecipeId,
  onSelectedRecipeChange,
  searchLabel,
  searchPlaceholder,
  emptyText,
  recipeLabel,
  emptySelectionLabel,
  getExcludedRecipeIds = () => [],
  disabled = false,
}: ProducedRecipeSelectorProps) {
  const [itemQuery, setItemQuery] = useState('');

  const availableItemOptions = useMemo(
    () =>
      filterItemOptionsByRecipeAvailability(
        itemOptions,
        recipeOptionsByItem,
        getExcludedRecipeIds,
      ),
    [getExcludedRecipeIds, itemOptions, recipeOptionsByItem]
  );

  const recipeOptions = useMemo(
    () =>
      filterRecipeOptionsByExclusion(
        recipeOptionsByItem[selectedItemId],
        getExcludedRecipeIds(selectedItemId),
      ),
    [getExcludedRecipeIds, recipeOptionsByItem, selectedItemId]
  );

  const selectedItem = useMemo(
    () => itemOptions.find(item => item.itemId === selectedItemId) ?? null,
    [itemOptions, selectedItemId]
  );

  useEffect(() => {
    if (
      selectedItemId &&
      !availableItemOptions.some(item => item.itemId === selectedItemId)
    ) {
      onSelectedItemChange('');
    }
  }, [availableItemOptions, onSelectedItemChange, selectedItemId]);

  useEffect(() => {
    if (
      selectedRecipeId &&
      !recipeOptions.some(option => option.recipeId === selectedRecipeId)
    ) {
      onSelectedRecipeChange('');
    }
  }, [onSelectedRecipeChange, recipeOptions, selectedRecipeId]);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1,
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        alignItems: 'start',
      }}
    >
      <ItemGridPicker
        items={availableItemOptions}
        selectedItemId={selectedItemId}
        query={itemQuery}
        onQueryChange={setItemQuery}
        onSelect={itemId => {
          if (itemId !== selectedItemId) {
            onSelectedRecipeChange('');
          }
          onSelectedItemChange(itemId);
        }}
        atlasIds={atlasIds}
        searchLabel={searchLabel}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        selectedItemName={selectedItem?.name}
        selectedItemIcon={selectedItem?.icon}
        disabled={disabled}
      />

      <TextField
        select
        fullWidth
        size="small"
        sx={compactSelectFieldSx}
        label={recipeLabel}
        value={selectedRecipeId}
        disabled={disabled || !selectedItemId || recipeOptions.length === 0}
        onChange={event => onSelectedRecipeChange(event.target.value)}
      >
        <MenuItem value="">{emptySelectionLabel}</MenuItem>
        {recipeOptions.map(option => (
          <MenuItem key={option.recipeId} value={option.recipeId}>
            <RecipeOptionLabel
              recipeName={option.recipeName}
              inputs={option.inputs}
              outputs={option.outputs}
              cycleTimeSec={option.cycleTimeSec}
              locale={locale}
              atlasIds={atlasIds}
              highlightItemId={selectedItemId}
            />
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
