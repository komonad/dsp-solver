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

export default function DisabledBuildingInlineEditor() {
  const { bundle, catalog, buildingOptions } = useCatalog();
  const { disabledBuildingIds, addDisabledBuilding } = useWorkbench();

  const availableOptions = useMemo(
    () => buildingOptions.filter(building => !disabledBuildingIds.includes(building.buildingId)),
    [buildingOptions, disabledBuildingIds]
  );

  const [draftId, setDraftId] = useState('');

  useEffect(() => {
    if (!draftId && availableOptions.length > 0) {
      setDraftId(availableOptions[0].buildingId);
      return;
    }
    if (
      draftId &&
      availableOptions.length > 0 &&
      !availableOptions.some(building => building.buildingId === draftId)
    ) {
      setDraftId(availableOptions[0].buildingId);
    }
  }, [draftId, availableOptions]);

  function handleAdd() {
    if (!draftId) return;
    addDisabledBuilding(draftId);
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
            'aria-label': bundle.solveRequest.disabledBuildingsLabel,
          },
        }}
      >
        {availableOptions.map(building => (
          <MenuItem key={building.buildingId} value={building.buildingId}>
            <SelectOption label={building.name} iconKey={building.icon} size={18} />
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
        {bundle.solveRequest.disableButton}
      </Button>
    </Box>
  );
}
