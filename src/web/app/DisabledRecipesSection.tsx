import React, { useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import ProducedRecipeSelector from './ProducedRecipeSelector';
import { useWorkbench } from './WorkbenchContext';
import { collapsibleSectionStyle, summaryStyle } from './workbenchStyles';

export default function DisabledRecipesSection() {
  const {
    bundle,
    locale,
    catalog,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
    disabledRecipeIds,
    addDisabledRecipe,
    removeDisabledRecipe,
  } = useWorkbench();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  return (
    <details style={collapsibleSectionStyle}>
      <summary style={summaryStyle}>{bundle.solveRequest.disabledRecipesLabel}</summary>
      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <Box
          sx={{
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) auto' },
            alignItems: 'start',
          }}
        >
          <ProducedRecipeSelector
            locale={locale}
            atlasIds={iconAtlasIds}
            itemOptions={itemOptions}
            recipeOptionsByItem={preferredRecipeOptionsByItem}
            selectedItemId={selectedItemId}
            onSelectedItemChange={setSelectedItemId}
            selectedRecipeId={selectedRecipeId}
            onSelectedRecipeChange={setSelectedRecipeId}
            searchLabel={bundle.solveRequest.targetSearchLabel}
            searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
            emptyText={bundle.solveRequest.targetPickerEmpty}
            recipeLabel={bundle.solveRequest.disabledRecipesLabel}
            emptySelectionLabel={bundle.common.notSet}
            getExcludedRecipeIds={() => disabledRecipeIds}
          />

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              if (!selectedRecipeId) {
                return;
              }
              addDisabledRecipe(selectedRecipeId);
              setSelectedRecipeId('');
            }}
            disabled={!selectedRecipeId}
            sx={{ minHeight: 40, px: 1.5 }}
          >
            {bundle.solveRequest.disableButton}
          </Button>
        </Box>

        <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
          {disabledRecipeIds.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {bundle.solveRequest.noDisabledRecipes}
            </Typography>
          ) : (
            disabledRecipeIds.map(recipeId => (
              <Chip
                key={recipeId}
                label={(catalog?.recipeMap.get(recipeId)?.name ?? recipeId) + ` ${bundle.common.removeSuffix}`}
                onDelete={() => removeDisabledRecipe(recipeId)}
              />
            ))
          )}
        </Stack>
      </div>
    </details>
  );
}
