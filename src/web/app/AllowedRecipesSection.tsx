import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useWorkbench } from './WorkbenchContext';
import ProducedRecipeSelector from './ProducedRecipeSelector';
import {
  collapsibleSectionStyle,
  inlineSectionLabelSx,
  inlineSectionLayoutSx,
} from './workbenchStyles';

export default function AllowedRecipesSection() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
    allowedRecipesByItem,
    applyAllowedRecipesForItem,
  } = useWorkbench();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [message, setMessage] = useState('');

  return (
    <section style={collapsibleSectionStyle}>
      <Box sx={inlineSectionLayoutSx}>
        <Typography variant="subtitle2" sx={inlineSectionLabelSx}>
          {bundle.summary.forcedRecipesLabel}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            flex: '1 1 0',
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
            onSelectedItemChange={itemId => {
              setSelectedItemId(itemId);
              setMessage('');
            }}
            selectedRecipeId={selectedRecipeId}
            onSelectedRecipeChange={recipeId => {
              setSelectedRecipeId(recipeId);
              setMessage('');
            }}
            searchLabel={bundle.solveRequest.targetSearchLabel}
            searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
            emptyText={bundle.solveRequest.targetPickerEmpty}
            recipeLabel={bundle.summary.forcedRecipesLabel}
            emptySelectionLabel={bundle.common.notSet}
            getExcludedRecipeIds={itemId => allowedRecipesByItem[itemId] ?? []}
          />

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              if (!selectedItemId || !selectedRecipeId) {
                return;
              }

              const existing = allowedRecipesByItem[selectedItemId] ?? [];
              const result = applyAllowedRecipesForItem(selectedItemId, [
                ...existing,
                selectedRecipeId,
              ]);
              if (result.accepted) {
                setSelectedRecipeId('');
                setMessage('');
              } else {
                setMessage(result.message);
              }
            }}
            disabled={!selectedRecipeId}
            sx={{ minHeight: 40, px: 1.5 }}
          >
            {bundle.solveRequest.addTarget}
          </Button>
        </Box>
      </Box>

      {message ? (
        <Typography variant="body2" color="warning.main" sx={{ mt: 0.75 }}>
          {message}
        </Typography>
      ) : null}
    </section>
  );
}
