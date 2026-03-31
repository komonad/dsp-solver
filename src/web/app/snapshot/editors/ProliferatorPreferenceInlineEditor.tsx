import { useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import type { ProliferatorMode } from '../../../../catalog';
import ProducedRecipeSelector from '../../request/ProducedRecipeSelector';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import {
  snapshotInlineButtonSx,
  snapshotInlineEditorSx,
  snapshotSelectFieldSx,
} from '../../workbenchStyles';

export default function ProliferatorPreferenceInlineEditor() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    preferredRecipeOptionsByItem,
    getRecipeModeOptions,
    getRecipeLevelOptions,
  } = useCatalog();
  const { setRecipePreferredProliferator } = useWorkbench();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [mode, setMode] = useState<'' | ProliferatorMode>('');
  const [level, setLevel] = useState<'' | number>('');

  const modeOptions = selectedRecipeId ? getRecipeModeOptions(selectedRecipeId) : [];
  const levelOptions = selectedRecipeId ? getRecipeLevelOptions(selectedRecipeId) : [];

  const canAdd = !!selectedRecipeId && mode !== '';

  function handleAdd() {
    if (!selectedRecipeId || mode === '') return;
    setRecipePreferredProliferator(selectedRecipeId, mode, mode === 'none' ? 0 : level);
    setSelectedRecipeId('');
    setMode('');
    setLevel('');
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
        onSelectedRecipeChange={recipeId => {
          setSelectedRecipeId(recipeId);
          setMode('');
          setLevel('');
        }}
        searchLabel={bundle.solveRequest.targetSearchLabel}
        searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
        emptyText={bundle.solveRequest.targetPickerEmpty}
        recipeLabel={bundle.summary.recipesLabel}
        emptySelectionLabel={bundle.common.notSet}
        dense
      />
      <TextField
        select
        size="small"
        sx={{ ...snapshotSelectFieldSx, flex: '0 0 auto', minWidth: 70 }}
        label={bundle.summary.sprayLabel}
        value={mode}
        disabled={!selectedRecipeId || modeOptions.length === 0}
        onChange={event => {
          const nextMode = event.target.value as '' | ProliferatorMode;
          setMode(nextMode);
          if (nextMode === 'none' || nextMode === '') {
            setLevel(nextMode === 'none' ? 0 : '');
          }
        }}
      >
        <MenuItem value="">{bundle.common.notSet}</MenuItem>
        {modeOptions.map(m => (
          <MenuItem key={m} value={m}>
            {bundle.solveRequest.proliferatorPolicyOptions[m] ?? m}
          </MenuItem>
        ))}
      </TextField>
      {mode !== '' && mode !== 'none' ? (
        <TextField
          select
          size="small"
          sx={{ ...snapshotSelectFieldSx, flex: '0 0 auto', minWidth: 60 }}
          label={bundle.solveRequest.preferredSprayLevelLabel}
          value={level === '' ? '' : String(level)}
          disabled={levelOptions.length === 0}
          onChange={event =>
            setLevel(event.target.value ? Number(event.target.value) : '')
          }
        >
          <MenuItem value="">{bundle.common.auto}</MenuItem>
          {levelOptions.map(l => (
            <MenuItem key={l} value={String(l)}>
              {`${bundle.solveRequest.levelPrefix} ${l}`}
            </MenuItem>
          ))}
        </TextField>
      ) : null}
      <Button
        variant="outlined"
        size="small"
        onClick={handleAdd}
        disabled={!canAdd}
        sx={snapshotInlineButtonSx}
      >
        {bundle.solveRequest.addTarget}
      </Button>
    </Box>
  );
}
