import { useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { SelectOption } from '../components/SelectOption';
import { useCatalog } from '../CatalogContext';
import { useWorkbench } from '../WorkbenchContext';
import {
  collapsibleSectionStyle,
  compactSelectFieldSx,
  inlineSectionLabelSx,
  inlineSectionLayoutSx,
} from '../workbenchStyles';

export default function DisabledBuildingsSection() {
  const { bundle, catalog, buildingOptions } = useCatalog();
  const {
    disabledBuildingIds,
    addDisabledBuilding,
  } = useWorkbench();

  const disableBuildingOptions = useMemo(
    () => buildingOptions.filter(building => !disabledBuildingIds.includes(building.buildingId)),
    [buildingOptions, disabledBuildingIds]
  );

  const [draftId, setDraftId] = useState('');

  useEffect(() => {
    if (!draftId && disableBuildingOptions.length > 0) {
      setDraftId(disableBuildingOptions[0].buildingId);
      return;
    }
    if (
      draftId &&
      disableBuildingOptions.length > 0 &&
      !disableBuildingOptions.some(building => building.buildingId === draftId)
    ) {
      setDraftId(disableBuildingOptions[0].buildingId);
    }
  }, [draftId, disableBuildingOptions]);

  return (
    <section style={collapsibleSectionStyle}>
      <Box sx={inlineSectionLayoutSx}>
        <Typography variant="subtitle2" sx={inlineSectionLabelSx}>
          {bundle.solveRequest.disabledBuildingsLabel}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            flex: '1 1 0',
            display: 'grid',
            gap: 1,
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'start',
          }}
        >
          <TextField
            select
            fullWidth
            size="small"
            sx={compactSelectFieldSx}
            value={draftId}
            onChange={event => setDraftId(event.target.value)}
            disabled={!catalog || disableBuildingOptions.length === 0}
            slotProps={{
              htmlInput: {
                'aria-label': bundle.solveRequest.disabledBuildingsLabel,
              },
            }}
          >
            {disableBuildingOptions.map(building => (
              <MenuItem key={building.buildingId} value={building.buildingId}>
                <SelectOption label={building.name} iconKey={building.icon} size={18} />
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            size="small"
            onClick={() => addDisabledBuilding(draftId)}
            disabled={!draftId}
            sx={{ minHeight: 40, px: 1.5, whiteSpace: 'nowrap', justifySelf: 'start' }}
          >
            {bundle.solveRequest.disableButton}
          </Button>
        </Box>
      </Box>
    </section>
  );
}
