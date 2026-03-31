import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ProducedRecipeSelector from '../../request/ProducedRecipeSelector';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import { snapshotInlineButtonSx, snapshotInlineEditorSx } from '../../workbenchStyles';

export default function AllowedRecipeInlineEditor() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
  } = useCatalog();
  const { allowedRecipesByItem, applyAllowedRecipesForItem } = useWorkbench();
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [message, setMessage] = useState('');

  function handleAdd() {
    if (!selectedItemId || !selectedRecipeId) return;
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
  }

  return (
    <Box sx={snapshotInlineEditorSx}>
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'start', gap: 0.5 }}>
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
          dense
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleAdd}
          disabled={!selectedRecipeId}
          sx={snapshotInlineButtonSx}
        >
          {bundle.solveRequest.addTarget}
        </Button>
      </Box>
      {message ? (
        <Typography variant="caption" color="warning.main">
          {message}
        </Typography>
      ) : null}
    </Box>
  );
}
