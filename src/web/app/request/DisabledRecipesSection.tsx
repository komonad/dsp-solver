import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ProducedRecipeSelector from './ProducedRecipeSelector';
import { useWorkbench } from '../WorkbenchContext';
import {
  collapsibleSectionStyle,
  inlineSectionLabelSx,
  inlineSectionLayoutSx,
} from '../workbenchStyles';

export default function DisabledRecipesSection() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
    disabledRecipeIds,
    addDisabledRecipe,
  } = useWorkbench();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  return (
    <section style={collapsibleSectionStyle}>
      <Box sx={inlineSectionLayoutSx}>
        <Typography variant="subtitle2" sx={inlineSectionLabelSx}>
          {bundle.solveRequest.disabledRecipesLabel}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            flex: '1 1 0',
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) auto' },
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
            sx={{ minHeight: 40, px: 1.5, whiteSpace: 'nowrap', justifySelf: 'start' }}
          >
            {bundle.solveRequest.disableButton}
          </Button>
        </Box>
      </Box>
    </section>
  );
}
