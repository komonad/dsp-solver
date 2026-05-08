import { useEffect, useMemo, useState } from 'react';
import { Box, Button, MenuItem, TextField } from '@mui/material';
import ProducedRecipeSelector from '../../request/ProducedRecipeSelector';
import { SelectOption } from '../../components/SelectOption';
import { useCatalog } from '../../CatalogContext';
import { useWorkbench } from '../../WorkbenchContext';
import {
  snapshotInlineButtonSx,
  snapshotInlineEditorSx,
  snapshotSelectFieldSx,
} from '../../workbenchStyles';

export default function PreferredBuildingInlineEditor() {
  const {
    bundle,
    locale,
    catalog,
    iconAtlasIds,
    recipeItemOptions,
    buildingOptions,
    preferredRecipeOptionsByItem,
    getRecipeBuildingOptions,
  } = useCatalog();
  const { addPreferredBuilding } = useWorkbench();

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

  function handleAdd() {
    if (!selectedBuildingId || (!isGlobal && !selectedRecipeId)) return;
    addPreferredBuilding({
      buildingId: selectedBuildingId,
      recipeId: isGlobal ? '' : selectedRecipeId,
    });
    setSelectedBuildingId('');
  }

  return (
    <Box sx={snapshotInlineEditorSx}>
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'start', gap: 0.5 }}>
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
          sx={snapshotInlineButtonSx}
        >
          {bundle.solveRequest.preferredBuildingGlobalScope}
        </Button>
        {!isGlobal ? (
          <ProducedRecipeSelector
            locale={locale}
            atlasIds={iconAtlasIds}
            powerItemId={catalog?.powerItemId}
            itemOptions={recipeItemOptions}
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
            dense
          />
        ) : null}
        <TextField
          select
          size="small"
          sx={{ ...snapshotSelectFieldSx, minWidth: 90, flex: '0 0 auto' }}
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
          onClick={handleAdd}
          disabled={!selectedBuildingId || (!isGlobal && !selectedRecipeId)}
          sx={snapshotInlineButtonSx}
        >
          {bundle.solveRequest.addPreferredBuilding}
        </Button>
      </Box>
    </Box>
  );
}
