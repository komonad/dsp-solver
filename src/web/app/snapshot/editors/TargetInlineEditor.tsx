import { Box, Button, InputAdornment, TextField } from '@mui/material';
import ItemGridPicker from '../../../shared/ItemGridPicker';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import { useWorkbenchDraft } from '../../WorkbenchDraftContext';
import {
  snapshotInlineButtonSx,
  snapshotInlineEditorSx,
  snapshotInlineFieldSx,
} from '../../workbenchStyles';

export default function TargetInlineEditor() {
  const rateUnitLabel = '/\u5206';
  const { bundle, catalog, iconAtlasIds, itemOptions } = useCatalog();
  const { addTarget } = useWorkbench();
  const {
    targetDraftItemId,
    targetDraftRatePerMin,
    targetPickerQuery,
    targetDraftItemOption,
    setTargetPickerQuery,
    setTargetDraftItemId,
    setTargetDraftRatePerMin,
  } = useWorkbenchDraft();

  function handleAdd() {
    if (!catalog || !targetDraftItemId) return;
    addTarget({ itemId: targetDraftItemId, ratePerMin: targetDraftRatePerMin });
  }

  return (
    <Box sx={{ ...snapshotInlineEditorSx, display: 'flex', flexWrap: 'nowrap', alignItems: 'start' }}>
      <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
        <ItemGridPicker
          items={itemOptions}
          selectedItemId={targetDraftItemId}
          query={targetPickerQuery}
          onQueryChange={setTargetPickerQuery}
          onSelect={setTargetDraftItemId}
          atlasIds={iconAtlasIds}
          searchLabel={bundle.solveRequest.targetSearchLabel}
          searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
          emptyText={bundle.solveRequest.targetPickerEmpty}
          selectedItemName={targetDraftItemOption?.name}
          selectedItemIcon={targetDraftItemOption?.icon}
          dense
        />
      </Box>
      <TextField
        type="text"
        size="small"
        label={bundle.overview.requestLabel}
        value={targetDraftRatePerMin}
        inputProps={{ inputMode: 'decimal' }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: 11 } }}>
              {rateUnitLabel}
            </InputAdornment>
          ),
        }}
        onChange={event => setTargetDraftRatePerMin(Number(event.target.value) || 0)}
        sx={{
          ...snapshotInlineFieldSx,
          flex: '0 0 auto',
          width: 90,
          '& .MuiInputBase-input': { textAlign: 'right' },
        }}
      />
      <Button
        variant="outlined"
        size="small"
        onClick={handleAdd}
        disabled={!catalog || !targetDraftItemId}
        sx={snapshotInlineButtonSx}
      >
        {bundle.solveRequest.addTarget}
      </Button>
    </Box>
  );
}
