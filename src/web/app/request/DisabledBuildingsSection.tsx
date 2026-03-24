import React from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { SelectOption } from '../components/SelectOption';
import { useWorkbench } from '../WorkbenchContext';
import {
  collapsibleSectionStyle,
  compactSelectFieldSx,
  inlineSectionLabelSx,
  inlineSectionLayoutSx,
} from '../workbenchStyles';

export default function DisabledBuildingsSection() {
  const {
    bundle,
    catalog,
    disabledBuildingDraftId,
    disableBuildingOptions,
    setDisabledBuildingDraftId,
    addDisabledBuilding,
  } = useWorkbench();

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
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) auto' },
            alignItems: 'start',
          }}
        >
          <TextField
            select
            fullWidth
            size="small"
            sx={compactSelectFieldSx}
            label={bundle.solveRequest.disabledBuildingsLabel}
            value={disabledBuildingDraftId}
            onChange={event => setDisabledBuildingDraftId(event.target.value)}
            disabled={!catalog || disableBuildingOptions.length === 0}
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
            onClick={addDisabledBuilding}
            disabled={!disabledBuildingDraftId}
            sx={{ minHeight: 40, px: 1.5, whiteSpace: 'nowrap', justifySelf: 'start' }}
          >
            {bundle.solveRequest.disableButton}
          </Button>
        </Box>
      </Box>
    </section>
  );
}
