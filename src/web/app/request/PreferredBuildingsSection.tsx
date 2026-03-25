import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import ProducedRecipeSelector from './ProducedRecipeSelector';
import { SelectOption } from '../components/SelectOption';
import { useWorkbench } from '../WorkbenchContext';
import {
  collapsibleSectionStyle,
  compactSelectFieldSx,
  inlineSectionLabelSx,
  inlineSectionLayoutSx,
} from '../workbenchStyles';

export default function PreferredBuildingsSection() {
  const {
    bundle,
    locale,
    iconAtlasIds,
    itemOptions,
    buildingOptions,
    preferredRecipeOptionsByItem,
    getRecipeBuildingOptions,
    addPreferredBuilding,
  } = useWorkbench();
  const [isGlobal, setIsGlobal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');

  const compatibleBuildings = useMemo(
    () => (isGlobal ? buildingOptions : getRecipeBuildingOptions(selectedRecipeId)),
    [buildingOptions, getRecipeBuildingOptions, isGlobal, selectedRecipeId]
  );

  useEffect(() => {
    if (
      selectedBuildingId &&
      !compatibleBuildings.some(building => building.buildingId === selectedBuildingId)
    ) {
      setSelectedBuildingId('');
    }
  }, [compatibleBuildings, selectedBuildingId]);

  return (
    <section style={collapsibleSectionStyle}>
      <Box sx={inlineSectionLayoutSx}>
        <Typography variant="subtitle2" sx={inlineSectionLabelSx}>
          {bundle.solveRequest.preferredBuildingsLabel}
        </Typography>
        <Box
          sx={{
            minWidth: 0,
            flex: '1 1 0',
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'auto minmax(0, 1fr) minmax(140px, auto) auto',
            },
            alignItems: 'start',
          }}
        >
          <Button
            variant={isGlobal ? 'contained' : 'outlined'}
            size="small"
            onClick={() => {
              setIsGlobal(current => {
                const next = !current;
                if (next) {
                  setSelectedItemId('');
                  setSelectedRecipeId('');
                }
                return next;
              });
            }}
            sx={{ justifySelf: 'start', minHeight: 40, px: 1.5, whiteSpace: 'nowrap' }}
          >
            {bundle.solveRequest.preferredBuildingGlobalScope}
          </Button>

          <Box
            sx={{
              minWidth: 0,
            }}
          >
            <ProducedRecipeSelector
              locale={locale}
              atlasIds={iconAtlasIds}
              itemOptions={itemOptions}
              recipeOptionsByItem={preferredRecipeOptionsByItem}
              selectedItemId={selectedItemId}
              onSelectedItemChange={itemId => {
                setIsGlobal(false);
                setSelectedItemId(itemId);
              }}
              selectedRecipeId={selectedRecipeId}
              onSelectedRecipeChange={recipeId => {
                setIsGlobal(false);
                setSelectedRecipeId(recipeId);
              }}
              searchLabel={bundle.solveRequest.targetSearchLabel}
              searchPlaceholder={bundle.solveRequest.targetSearchPlaceholder}
              emptyText={bundle.solveRequest.targetPickerEmpty}
              recipeLabel={bundle.summary.recipesLabel}
              emptySelectionLabel={bundle.common.notSet}
              disabled={isGlobal}
            />
          </Box>

          <TextField
            select
            fullWidth
            size="small"
            sx={compactSelectFieldSx}
            label={bundle.summary.buildingsLabel}
            value={selectedBuildingId}
            disabled={compatibleBuildings.length === 0}
            onChange={event => setSelectedBuildingId(event.target.value)}
          >
            <MenuItem value="">{bundle.common.notSet}</MenuItem>
            {compatibleBuildings.map(building => (
              <MenuItem key={building.buildingId} value={building.buildingId}>
                <SelectOption label={building.name} iconKey={building.icon} size={18} />
              </MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              addPreferredBuilding({
                buildingId: selectedBuildingId,
                recipeId: isGlobal ? '' : selectedRecipeId,
              });
              setSelectedBuildingId('');
            }}
            disabled={!selectedBuildingId || (!isGlobal && !selectedRecipeId)}
            sx={{ minHeight: 40, px: 1.5, whiteSpace: 'nowrap', justifySelf: 'start' }}
          >
            {bundle.solveRequest.addPreferredBuilding}
          </Button>
        </Box>
      </Box>
    </section>
  );
}
