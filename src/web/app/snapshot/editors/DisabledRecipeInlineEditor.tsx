import { useState } from 'react';
import { Box, Button } from '@mui/material';
import ProducedRecipeSelector from '../../request/ProducedRecipeSelector';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import { snapshotInlineButtonSx, snapshotInlineEditorSx } from '../../workbenchStyles';

export default function DisabledRecipeInlineEditor() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
  } = useCatalog();
  const { disabledRecipeIds, addDisabledRecipe } = useWorkbench();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');

  function handleAdd() {
    if (!selectedRecipeId) return;
    addDisabledRecipe(selectedRecipeId);
    setSelectedRecipeId('');
  }

  return (
    <Box sx={{ ...snapshotInlineEditorSx, display: 'flex', flexWrap: 'nowrap', alignItems: 'start' }}>
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
        dense
      />
      <Button
        variant="outlined"
        size="small"
        onClick={handleAdd}
        disabled={!selectedRecipeId}
        sx={snapshotInlineButtonSx}
      >
        {bundle.solveRequest.disableButton}
      </Button>
    </Box>
  );
}
