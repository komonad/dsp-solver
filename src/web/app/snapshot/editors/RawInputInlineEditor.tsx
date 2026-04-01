import { useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import { SelectOption } from '../../components/SelectOption';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import {
  snapshotInlineButtonSx,
  snapshotInlineEditorSx,
  snapshotSelectFieldSx,
} from '../../workbenchStyles';

export default function RawInputInlineEditor() {
  const { bundle, catalog, itemOptions } = useCatalog();
  const { rawInputItemIds, disabledRawInputItemIds, markItemAsRawInput } = useWorkbench();

  const resolvedRawItemIds = useMemo(() => {
    if (!catalog) return new Set<string>();
    const set = new Set(catalog.rawItemIds);
    for (const id of disabledRawInputItemIds) set.delete(id);
    for (const id of rawInputItemIds) set.add(id);
    return set;
  }, [catalog, rawInputItemIds, disabledRawInputItemIds]);

  const availableOptions = useMemo(
    () => itemOptions.filter(item => !resolvedRawItemIds.has(item.itemId)),
    [itemOptions, resolvedRawItemIds]
  );

  const [draftId, setDraftId] = useState('');

  useEffect(() => {
    if (!draftId && availableOptions.length > 0) {
      setDraftId(availableOptions[0].itemId);
      return;
    }
    if (
      draftId &&
      availableOptions.length > 0 &&
      !availableOptions.some(item => item.itemId === draftId)
    ) {
      setDraftId(availableOptions[0].itemId);
    }
  }, [draftId, availableOptions]);

  function handleAdd() {
    if (!draftId) return;
    markItemAsRawInput(draftId);
  }

  return (
    <Box sx={{ ...snapshotInlineEditorSx, display: 'flex', flexWrap: 'nowrap', alignItems: 'start' }}>
      <TextField
        select
        size="small"
        sx={{ ...snapshotSelectFieldSx, flex: '1 1 auto', minWidth: 0 }}
        value={draftId}
        onChange={event => setDraftId(event.target.value)}
        disabled={!catalog || availableOptions.length === 0}
        slotProps={{
          htmlInput: {
            'aria-label': bundle.summary.rawInputsLabel,
          },
        }}
      >
        {availableOptions.map(item => (
          <MenuItem key={item.itemId} value={item.itemId}>
            <SelectOption label={item.name} iconKey={item.icon} size={18} />
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="outlined"
        size="small"
        onClick={handleAdd}
        disabled={!draftId}
        sx={snapshotInlineButtonSx}
      >
        {bundle.solveRequest.markAsRaw}
      </Button>
    </Box>
  );
}
